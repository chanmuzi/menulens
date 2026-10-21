/**
 * POST /api/chat → NDJSON 스트림 { t:'delta', text } … { t:'done', refs: string[], sawImage } | { t:'need_image' } | { t:'error', m }
 * 메뉴판 결과(항목·문구 JSON)와 질문으로 Sonnet 에 한 번 묻는다. 사진은 클라이언트가 필요하다고 판단했을 때만 붙여 보낸다.
 * 사진 없이 답할 수 없으면 모델이 [사진 필요] 만 내고, 그러면 need_image 이벤트로 끝낸다(클라이언트가 사진을 붙여 다시 묻는다).
 */
import { codeFrom, isAllowed } from './_lib/access.js';
import { errorJson } from './_lib/http.js';
import { MODEL } from './_lib/prompt.js';
import { CHAT_SYSTEM, NEED_IMAGE_MARK } from './_lib/chatPrompt.js';

const UPSTREAM = 'https://api.timelyrouter.ai/v1/messages';
const MAX_ITEMS = 120;
const MAX_HISTORY = 6;
const MAX_QUESTION = 300;
/** 사진 base64 상한(≈2.2MB). 클라이언트는 1280px JPEG 라 보통 수백 KB */
const MAX_IMAGE_B64 = 3_000_000;

type Item = { k: string; ja: string; ko: string; price: number | null; desc: string; group: string | null };
type Note = { ja: string; ko: string };
type Turn = { role: 'me' | 'bot'; text: string };
type Body = { shop?: string | null; kind?: string; items?: Item[]; notes?: Note[]; focus?: string | null; question?: string; history?: Turn[]; image?: { data: string; mediaType: string } | null };

const enc = new TextEncoder();
const line = (obj: Record<string, unknown>): Uint8Array => enc.encode(JSON.stringify(obj) + '\n');
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** 입력을 검증·축약한다. 설명은 60자, 항목 120개까지 */
const sanitize = (b: Body) => ({
  shop: str(b.shop, 60) || null,
  kind: str(b.kind, 10) || 'menu',
  items: (Array.isArray(b.items) ? b.items : []).slice(0, MAX_ITEMS).map((it) => ({
    k: str(it?.k, 12), ja: str(it?.ja, 60), ko: str(it?.ko, 60), price: typeof it?.price === 'number' ? it.price : null, desc: str(it?.desc, 60), group: str(it?.group, 12) || null,
  })).filter((it) => it.k && it.ja),
  notes: (Array.isArray(b.notes) ? b.notes : []).slice(0, 40).map((n) => ({ ja: str(n?.ja, 80), ko: str(n?.ko, 80) })).filter((n) => n.ja),
  focus: str(b.focus, 12) || null,
  question: str(b.question, MAX_QUESTION),
  history: dropLeadingBot((Array.isArray(b.history) ? b.history : []).slice(-MAX_HISTORY).map((t): { role: 'me' | 'bot'; text: string } => ({ role: t?.role === 'me' ? 'me' : 'bot', text: str(t?.text, 400) })).filter((t) => t.text)),
  image: b.image && typeof b.image.data === 'string' && b.image.data.length <= MAX_IMAGE_B64 && /^image\/(jpeg|png|webp)$/.test(b.image.mediaType ?? '') ? { data: b.image.data, mediaType: b.image.mediaType } : null,
});
/** 대화는 user 턴으로 시작해야 한다(실패해서 답이 없는 질문이 섞이면 앞이 bot 으로 시작할 수 있다) */
const dropLeadingBot = (h: ReadonlyArray<{ role: 'me' | 'bot'; text: string }>): ReadonlyArray<{ role: 'me' | 'bot'; text: string }> => { const i = h.findIndex((t) => t.role === 'me'); return i < 0 ? [] : h.slice(i); };

const requestBody = (p: ReturnType<typeof sanitize>): unknown => {
  const context = `가게: ${p.shop ?? '(모름)'} · 종류: ${p.kind}\n항목: ${JSON.stringify(p.items)}\n문구: ${JSON.stringify(p.notes)}\n지금 보는 항목: ${p.focus ?? '없음'}`;
  const prior = p.history.map((t) => ({ role: t.role === 'me' ? 'user' : 'assistant', content: t.text }));
  const ask = p.image
    ? [{ type: 'image', source: { type: 'base64', media_type: p.image.mediaType, data: p.image.data } }, { type: 'text', text: `${context}\n\n질문(사진 첨부): ${p.question}` }]
    : [{ type: 'text', text: `${context}\n\n질문: ${p.question}` }];
  return {
    model: MODEL, stream: true, max_tokens: 700, thinking: { type: 'adaptive' }, output_config: { effort: 'low' }, system: CHAT_SYSTEM,
    messages: [...prior, { role: 'user', content: ask }],
  };
};

/** Anthropic SSE 에서 text_delta 만 뽑는다 (analyze.ts 와 같은 파서) */
const readSse = async (body: ReadableStream<Uint8Array>, onText: (t: string) => void): Promise<void> => {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let pending = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += dec.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const l of lines) {
      if (!l.startsWith('data:')) continue;
      const raw = l.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const ev = JSON.parse(raw) as { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) onText(ev.delta.text);
        else if (ev.type === 'error') throw new Error(ev.error?.message ?? 'upstream error');
      } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
    }
  }
};

/** 끝의 「참조: …」 줄을 떼어 낸다 */
export const splitRefs = (text: string): { body: string; refs: string[] } => {
  const m = text.match(/(^|\n)\s*참조[:：]\s*([^\n]*)\s*$/);
  if (!m) return { body: text.trim(), refs: [] };
  return { body: text.slice(0, m.index).trim(), refs: m[2]!.replace(/：/g, ':').split(/[,、\s]+/).map((s) => s.trim()).filter((s) => /^\d+:\d+$/.test(s)) };
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
            if (trimmed.startsWith(NEED_IMAGE_MARK)) { needImage = true; return; }
            if (trimmed.length < NEED_IMAGE_MARK.length && NEED_IMAGE_MARK.startsWith(trimmed)) return;
            decided = true;
            send({ t: 'delta', text: head });
            return;
          }
          send({ t: 'delta', text: t });
        });
        // 사진을 이미 붙였는데도 사진을 달라고 하면 되묻지 않고 그대로 답으로 끝낸다
        if (needImage && p.image) { send({ t: 'delta', text: '사진에서도 찾지 못했어요.' }); send({ t: 'done', refs: [], sawImage: true }); controller.close(); return; }
        if (needImage) { send({ t: 'need_image' }); controller.close(); return; }
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
