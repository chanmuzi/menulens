/**
 * POST /api/chat → NDJSON 스트림 { t:'delta', text } … { t:'done', refs: string[], sawImage } | { t:'need_image', photo } | { t:'error', m }
 * 사진 결과(항목·글줄 JSON, 종류)와 질문으로 Sonnet 에 한 번 묻는다. 사진은 클라이언트가 필요하다고 판단했을 때만 붙여 보낸다.
 * 사진 없이 답할 수 없으면 모델이 [사진 필요] 만 내고, 그러면 need_image 이벤트로 끝낸다(클라이언트가 사진을 붙여 다시 묻는다).
 * 여러 장 묶음(photos ≥ 2)이면 항목·글줄에 사진 번호 p 가 있고, 모델은 [사진 필요: n] 으로 볼 사진을 지정한다 → need_image.photo.
 * 사진이 이미 첨부됐는데(imagePhoto) 다른 번호를 달라고 하면 한 번 더 need_image, 같은 번호면 「찾지 못했어요」로 끝낸다.
 * lang {src,dst} 는 사진의 방향(analyze 의 lang 이벤트 값): 답은 dst 언어. 없으면 일→한(옛 클라이언트).
 */
import { codeFrom, isAllowed } from './_lib/access.js';
import { errorJson } from './_lib/http.js';
import { MODEL } from './_lib/prompt.js';
import { readSse } from './_lib/claude.js';
import { asciiDigits, chatSystem, currencyLine, KIND_KO, NEED_IMAGE_PREFIXES, NOT_FOUND, parseNeedImage, REFS_LINE, type ChatKind } from './_lib/chatPrompt.js';
import { L } from './_lib/prompt.js';
import { parseDirection } from './_lib/direction.js';

const UPSTREAM = 'https://api.timelyrouter.ai/v1/messages';
/** 항목 상한. 묶음(최대 6장)이면 사진당 30개쯤까지 들어온다 */
const MAX_ITEMS = 200;
/** 글줄 상한(묶음 전체, 사진별 균등) */
const MAX_NOTES = 120;
/** 묶음 사진 수 상한(클라이언트 BATCH_MAX 와 같다) */
const MAX_PHOTOS = 6;
const MAX_HISTORY = 6;
const MAX_QUESTION = 300;
/** 사진 base64 상한(≈2.2MB). 클라이언트는 1280px JPEG 라 보통 수백 KB */
const MAX_IMAGE_B64 = 3_000_000;

/** 항목·글줄: src 는 원문, tr 은 번역(클라이언트 src/lib/chat.ts 의 ChatContext 와 같은 키) */
type Item = { k: string; src: string; tr: string; price: number | null; desc: string; group: string | null; p?: number };
type Note = { src: string; tr: string; p?: number };
type Turn = { role: 'me' | 'bot'; text: string };
type Body = { shop?: string | null; kind?: string; photos?: number; lang?: unknown; items?: Item[]; notes?: Note[]; focus?: string | null; question?: string; history?: Turn[]; image?: { data: string; mediaType: string } | null; imagePhoto?: number | null };

const enc = new TextEncoder();
const line = (obj: Record<string, unknown>): Uint8Array => enc.encode(JSON.stringify(obj) + '\n');
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
/** 1..MAX_PHOTOS 의 사진 번호. 아니면 null */
const photoNo = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= MAX_PHOTOS ? v : null);

/** 묶음 전체 예산을 사진마다 같은 몫으로 나눠 자른다(앞에서부터 자르면 뒤 사진이 통째로 빠진다). 한 장이면 그대로 앞에서부터 */
const capPerPhoto = <T extends { p?: number }>(list: readonly T[], max: number, photos: number): readonly T[] => {
  if (photos < 2) return list.slice(0, max);
  const per = Math.floor(max / photos);
  const seen = new Map<number, number>();
  return list.filter((x) => { const k = x.p ?? 0; const n = seen.get(k) ?? 0; seen.set(k, n + 1); return n < per; });
};

/** 입력을 검증·축약한다. 설명은 60자, 항목은 묶음 전체 200개(사진별 균등)까지 */
const sanitize = (b: Body) => {
  const photos = photoNo(b.photos) ?? 1;
  return {
  shop: str(b.shop, 60) || null,
  kind: toKind(b.kind),
  lang: parseDirection(b.lang),
  photos,
  items: capPerPhoto((Array.isArray(b.items) ? b.items : []).map((it) => ({
    k: str(it?.k, 12), src: str(it?.src, 60), tr: str(it?.tr, 60), price: typeof it?.price === 'number' ? it.price : null, desc: str(it?.desc, 60), group: str(it?.group, 12) || null,
    ...(photoNo(it?.p) !== null ? { p: photoNo(it?.p)! } : {}),
  })).filter((it) => it.k && it.src), MAX_ITEMS, photos),
  notes: capPerPhoto((Array.isArray(b.notes) ? b.notes : []).map((n) => ({ src: str(n?.src, 300), tr: str(n?.tr, 300), ...(photoNo(n?.p) !== null ? { p: photoNo(n?.p)! } : {}) })).filter((n) => n.src), MAX_NOTES, photos),
  focus: str(b.focus, 12) || null,
  question: str(b.question, MAX_QUESTION),
  history: dropLeadingBot((Array.isArray(b.history) ? b.history : []).slice(-MAX_HISTORY).map((t): { role: 'me' | 'bot'; text: string } => ({ role: t?.role === 'me' ? 'me' : 'bot', text: str(t?.text, 400) })).filter((t) => t.text)),
  image: b.image && typeof b.image.data === 'string' && b.image.data.length <= MAX_IMAGE_B64 && /^image\/(jpeg|png|webp)$/.test(b.image.mediaType ?? '') ? { data: b.image.data, mediaType: b.image.mediaType } : null,
  imagePhoto: photoNo(b.imagePhoto),
  };
};
const toKind = (v: unknown): ChatKind => (v === 'sign' || v === 'other' ? v : 'menu');
/** 대화는 user 턴으로 시작해야 한다(실패해서 답이 없는 질문이 섞이면 앞이 bot 으로 시작할 수 있다) */
const dropLeadingBot = (h: ReadonlyArray<{ role: 'me' | 'bot'; text: string }>): ReadonlyArray<{ role: 'me' | 'bot'; text: string }> => { const i = h.findIndex((t) => t.role === 'me'); return i < 0 ? [] : h.slice(i); };

const requestBody = (p: ReturnType<typeof sanitize>): unknown => {
  const context = `종류: ${KIND_KO[p.kind]}${p.shop ? ` · 가게: ${p.shop}` : ''}${p.photos > 1 ? ` · 사진 ${p.photos}장` : ''} · ${currencyLine(p.lang)}\n항목: ${JSON.stringify(p.items)}\n글줄: ${JSON.stringify(p.notes)}\n지금 보는 항목: ${p.focus ?? '없음'}`;
  const prior = p.history.map((t) => ({ role: t.role === 'me' ? 'user' : 'assistant', content: t.text }));
  // 답 언어 꼬리표: 옛 대화(다른 언어로 답한 기록)나 다른 언어 질문에 끌리지 않게 매 턴 적는다
  const tags = [p.image ? (p.photos > 1 && p.imagePhoto ? `사진 ${p.imagePhoto} 첨부` : '사진 첨부') : '', `답: ${L[p.lang.dst].name}`].filter(Boolean).join(' · ');
  const ask = p.image
    ? [{ type: 'image', source: { type: 'base64', media_type: p.image.mediaType, data: p.image.data } }, { type: 'text', text: `${context}\n\n질문(${tags}): ${p.question}` }]
    : [{ type: 'text', text: `${context}\n\n질문(${tags}): ${p.question}` }];
  return {
    model: MODEL, stream: true, max_tokens: 700, thinking: { type: 'adaptive' }, output_config: { effort: 'low' }, system: chatSystem(p.kind, p.photos, p.lang),
    messages: [...prior, { role: 'user', content: ask }],
  };
};

/** 끝의 「참조: …」 줄을 떼어 낸다(일본어 답의 「参照：」·전각 숫자도 받는다) */
export const splitRefs = (text: string): { body: string; refs: string[] } => {
  const m = text.match(REFS_LINE);
  if (!m) return { body: text.trim(), refs: [] };
  // 키는 「묶음:순번」, 묶음 사진이면 「사진번호-묶음:순번」
  return { body: text.slice(0, m.index).trim(), refs: asciiDigits(m[2]!).replace(/：/g, ':').split(/[,、\s]+/).map((s) => s.trim()).filter((s) => /^(\d+-)?\d+:\d+$/.test(s)) };
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  if (!isAllowed(codeFrom(req))) return errorJson('invalid access code', 401);
  const key = process.env.TIMELY_API_KEY;
  if (!key) return errorJson('TIMELY_API_KEY is not configured', 500);
  const p = sanitize((await req.json().catch(() => ({}))) as Body);
  if (!p.question) return errorJson('question is required', 400);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: Record<string, unknown>) => controller.enqueue(line(o));
      try {
        // 클라이언트가 끊으면 상류 생성도 멈춘다
        const res = await fetch(UPSTREAM, { signal: req.signal, method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify(requestBody(p)) });
        if (!res.ok || !res.body) throw new Error(`upstream ${res.status}`);
        // 첫 글자들이 [사진 필요] 인지 알기 전까지는 잠시 모아 둔다. 그 뒤로는 바로 흘려보낸다
        let head = '';
        let decided = false;
        let needImage = false;
        let full = '';
        await readSse(res.body, (t) => {
          full += t;
          if (needImage) return;
          if (!decided) {
            head += t;
            const trimmed = head.trimStart();
            if (NEED_IMAGE_PREFIXES.some((pre) => trimmed.startsWith(pre))) { needImage = true; return; }
            if (NEED_IMAGE_PREFIXES.some((pre) => trimmed.length < pre.length && pre.startsWith(trimmed))) return;
            decided = true;
            send({ t: 'delta', text: head });
            return;
          }
          send({ t: 'delta', text: t });
        });
        if (needImage) {
          // 묶음에서 번호를 지정했으면 그 사진. 번호가 없거나 범위 밖이면 클라이언트가 지금 보는 사진을 붙인다
          const want = parseNeedImage(full).photo;
          const photo = want !== null && want <= p.photos ? want : null;
          // 사진을 이미 붙였는데 같은 사진(또는 번호 없이)을 또 달라고 하면 되묻지 않고 그대로 답으로 끝낸다. 다른 사진이면 한 번 더 요청
          const other = p.image !== null && photo !== null && photo !== p.imagePhoto;
          if (p.image && !other) { send({ t: 'delta', text: NOT_FOUND[p.lang.dst] }); send({ t: 'done', refs: [], sawImage: true }); controller.close(); return; }
          send({ t: 'need_image', photo }); controller.close(); return;
        }
        if (!decided && head) send({ t: 'delta', text: head });
        const { body, refs } = splitRefs(full);
        send({ t: 'done', text: body, refs, sawImage: p.image !== null });
      } catch (e) {
        if (req.signal.aborted) return;
        try { send({ t: 'error', m: e instanceof Error ? e.message : String(e) }); } catch { /* 이미 닫힘 */ }
      }
      try { controller.close(); } catch { /* 이미 닫힘 */ }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
};

export default { fetch: handler };
