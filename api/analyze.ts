/**
 * POST /api/analyze  { image: base64, mediaType }
 *
 * 파이프라인 (docs/wiki/benchmarks.md):
 *   1) Upstage OCR → 단어·좌표·글자 방향 (≈2~4초). 결과를 먼저 클라이언트에 보낸다.
 *   2) 1단계 LLM: 단어 목록 → 항목(이름·가격·좌표·아이콘)만 짧게. 단어가 많으면 읽기 순서대로 묶어 병렬 호출.
 *      항목은 서버에서 파싱해 완성되는 즉시 보낸다.
 *   3) 2단계 LLM: 항목 10개씩 병렬로 발음·설명·태그를 받아 뒤따라 보낸다.
 * OCR 이 단어를 거의 못 읽으면 이미지를 직접 보는 폴백으로 간다 (2단계는 동일).
 *
 * 응답은 줄 단위 JSON (NDJSON):
 *   {"t":"ocr","width","height","words":[{id,t,box}],"rotation","tilt","ms","used"}
 *   {"t":"mode","mode":"ocr"|"image","chunks":N}
 *   {"t":"kind","kind":"menu"|"sign"|"other"}               1단계 출력의 첫 키(kind)가 보이는 즉시 (한 번만)
 *   {"t":"item","key":"<묶음>:<순번>","item":{...}}         1단계 항목 하나 완성마다
 *   {"t":"note","key":"<묶음>:<순번>","note":{...}}         1단계 문구(안내문은 문단) 하나 완성마다. meta.notes 가 최종본
 *   {"t":"meta","kind","shop_name","notes":[...]}            1단계 모든 묶음 완료 후
 *   {"t":"details","items":[{key,pron_ko,desc_ko,tags,photo_query}],"cached"?}  캐시 적중분 먼저, 이후 2단계 묶음마다
 *   {"t":"groups","groups":[{name,keys:[key,...]}]}           메뉴판 묶음 정리(2단계와 병렬, 메뉴판일 때만)
 *   {"t":"summary","summary_ko","tips_ko":[...]}              안내문·기타 요약(meta 뒤 한 번, 문단이 있을 때만)
 *   {"t":"error","m":"..."}
 *   {"t":"done"}
 */
import { codeFrom, isAllowed } from './_lib/access.js';
import { errorJson } from './_lib/http.js';
import { runOcr, type OcrResult, type OcrWord } from './_lib/ocr.js';
import { chunkWords } from './_lib/chunk.js';
import { createItemParser, parseLoose } from './_lib/itemStream.js';
import { cacheGetMany, cacheSetMany } from './_lib/cache.js';
import { saveDebug } from './_lib/debugStore.js';
import { GROUPS_SYSTEM, IMAGE_SYSTEM, IMAGE_USER_PROMPT, MODEL, STAGE1_SYSTEM, STAGE2_SYSTEM, SUMMARY_SYSTEM } from './_lib/prompt.js';

const UPSTREAM = 'https://api.timelyrouter.ai/v1/messages';
/** 이 수보다 단어가 적으면 OCR 을 믿지 않고 이미지 폴백 */
const MIN_WORDS = 3;
/** 2단계 병렬 호출 묶음 크기 */
const DETAIL_CHUNK = 10;

type Body = { image?: string; mediaType?: string };
type Line = Record<string, unknown>;
type RawItem = Record<string, unknown>;
type Stage1 = { kind?: string; shop_name?: string | null; notes?: unknown[] };
type Keyed = { key: string; name_ja: string; name_ko: string; group: string };

const enc = new TextEncoder();
const line = (obj: Line): Uint8Array => enc.encode(JSON.stringify(obj) + '\n');
const headers = (key: string) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' });
const llm = { model: MODEL, thinking: { type: 'adaptive' }, output_config: { effort: 'low' } };

const stage1Body = (words: readonly OcrWord[] | null, image: string, mediaType: string): unknown => ({
  ...llm, stream: true, max_tokens: 6000,
  system: words ? STAGE1_SYSTEM : IMAGE_SYSTEM,
  messages: [{
    role: 'user',
    content: words
      ? [{ type: 'text', text: '단어 목록:\n' + JSON.stringify(words) }]
      : [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: image } }, { type: 'text', text: IMAGE_USER_PROMPT }],
  }],
});

const stage2Body = (chunk: ReadonlyArray<{ i: number; name_ja: string; name_ko: string }>): unknown => ({
  ...llm, stream: false, max_tokens: 2500, system: STAGE2_SYSTEM,
  messages: [{ role: 'user', content: JSON.stringify(chunk) }],
});

const groupsBody = (items: ReadonlyArray<{ i: number; name_ja: string; name_ko: string; g: string }>): unknown => ({
  // 메뉴판 전체를 한 번에 받으므로 한도는 항목 수에 비례(번호 배열 ≈ 항목당 5토큰 + 생각 토큰). 잘리면 묶음 정리가 조용히 빠진다
  ...llm, stream: false, max_tokens: Math.min(4000, 1500 + items.length * 15), system: GROUPS_SYSTEM,
  messages: [{ role: 'user', content: JSON.stringify(items) }],
});

const summaryBody = (notes: ReadonlyArray<{ ja: string; ko: string }>): unknown => ({
  ...llm, stream: false, max_tokens: 1500, system: SUMMARY_SYSTEM,
  messages: [{ role: 'user', content: JSON.stringify(notes) }],
});

/** Anthropic SSE 를 읽어 text_delta 만 콜백으로 넘긴다 */
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
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
};

/** 1단계 한 묶음: 스트리밍하며 항목을 즉시 전송하고, 끝나면 메타와 항목 목록을 돌려준다 */
const KIND_RE = /"kind"\s*:\s*"(menu|sign|other)"/;

const runStage1Chunk = async (key: string, chunkIndex: number, words: readonly OcrWord[] | null, image: string, mediaType: string, send: (o: Line) => void, onKind: (k: string) => void, signal: AbortSignal): Promise<{ meta: Stage1 | null; items: Keyed[]; raw: RawItem[] }> => {
  const res = await fetch(UPSTREAM, { signal, method: 'POST', headers: headers(key), body: JSON.stringify(stage1Body(words, image, mediaType)) });
  if (!res.ok || !res.body) throw new Error(`upstream ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const parser = createItemParser();
  // 안내문은 items 가 비고 notes(문단)가 본문이라, 문단도 완성되는 즉시 보내 덮개가 위에서부터 차례로 뜨게 한다
  const noteParser = createItemParser('notes');
  const streamedNotes: unknown[] = [];
  const items: Keyed[] = [];
  const rawItems: RawItem[] = [];
  let kindSeen = false;
  await readSse(res.body, (d) => {
    const found = parser.push(d);
    for (const note of noteParser.push(d)) {
      if (typeof note !== 'object' || note === null) continue;
      send({ t: 'note', key: `${chunkIndex}:${streamedNotes.length}`, note });
      streamedNotes.push(note);
    }
    // kind 는 출력의 첫 키라 항목보다 먼저 온다. 보이는 즉시 알려 처리 중 화면이 종류에 맞는 문구를 쓰게 한다
    if (!kindSeen) {
      const m = KIND_RE.exec(parser.text());
      if (m) { kindSeen = true; onKind(m[1]!); }
    }
    for (const raw of found) {
      if (typeof raw !== 'object' || raw === null) continue;
      const it = raw as RawItem;
      const k = `${chunkIndex}:${items.length}`;
      items.push({ key: k, name_ja: typeof it.name_ja === 'string' ? it.name_ja : '', name_ko: typeof it.name_ko === 'string' ? it.name_ko : '', group: typeof it.group === 'string' ? it.group : '' });
      rawItems.push({ ...it, key: k });
      send({ t: 'item', key: k, item: it });
    }
  });
  let meta: Stage1 | null = null;
  try { meta = parseLoose(parser.text()) as Stage1; } catch { meta = null; }
  // 출력이 잘리거나 꼬리가 깨져 전체 파싱에 실패해도, 이미 보낸 문단은 meta 에 남겨 화면에서 사라지지 않게 한다
  if (streamedNotes.length > 0 && !(Array.isArray(meta?.notes) && meta.notes.length >= streamedNotes.length)) meta = { ...(meta ?? {}), notes: streamedNotes };
  return { meta, items, raw: rawItems };
};

/** 안내문·기타 요약. 실패하면 요약 없이 끝난다(덮개·번역문은 이미 보냈다) */
const runSummary = async (key: string, notes: readonly unknown[], send: (o: Line) => void, signal: AbortSignal): Promise<void> => {
  const payload = notes.flatMap((n) => {
    const r = (typeof n === 'object' && n !== null ? n : {}) as Record<string, unknown>;
    return typeof r.text_ja === 'string' && r.text_ja ? [{ ja: r.text_ja, ko: typeof r.text_ko === 'string' ? r.text_ko : '' }] : [];
  });
  if (payload.length === 0) return;
  try {
    const res = await fetch(UPSTREAM, { signal, method: 'POST', headers: headers(key), body: JSON.stringify(summaryBody(payload)) });
    if (!res.ok) return;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }>; stop_reason?: string };
    if (data.stop_reason === 'max_tokens') console.warn(`summary: 출력이 한도에서 잘림 (notes=${payload.length})`);
    const parsed = parseLoose((data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')) as { summary_ko?: unknown; tips_ko?: unknown };
    const summary = typeof parsed.summary_ko === 'string' ? parsed.summary_ko.trim() : '';
    const tips = Array.isArray(parsed.tips_ko) ? parsed.tips_ko.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, 2) : [];
    if (summary) send({ t: 'summary', summary_ko: summary, tips_ko: tips });
  } catch { /* 요약 없이 끝낸다 */ }
};

const DETAIL_FIELDS = ['pron_ko', 'desc_ko', 'tags', 'photo_query'] as const;
const pickDetail = (d: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(DETAIL_FIELDS.filter((f) => f in d).map((f) => [f, d[f]]));

const runStage2 = async (key: string, items: readonly Keyed[], send: (o: Line) => void, signal: AbortSignal): Promise<void> => {
  // 캐시에 있는 메뉴는 즉시 보내고, 나머지만 LLM 에 묻는다
  const cached = await cacheGetMany(items.filter((x) => x.name_ja).map((x) => x.name_ja));
  const hits = items.filter((x) => cached.has(x.name_ja)).map((x) => ({ ...cached.get(x.name_ja)!, key: x.key }));
  if (hits.length > 0) send({ t: 'details', items: hits, cached: true });
  const named = items.filter((x) => x.name_ja && !cached.has(x.name_ja));
  const chunks: Keyed[][] = [];
  for (let i = 0; i < named.length; i += DETAIL_CHUNK) chunks.push(named.slice(i, i + DETAIL_CHUNK));
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const payload = chunk.map((x, i) => ({ i, name_ja: x.name_ja, name_ko: x.name_ko }));
      const res = await fetch(UPSTREAM, { signal, method: 'POST', headers: headers(key), body: JSON.stringify(stage2Body(payload)) });
      if (!res.ok) return;
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
      const parsed = parseLoose(text) as { details?: Array<Record<string, unknown>> };
      if (!Array.isArray(parsed.details)) return;
      const out = parsed.details
        .filter((d) => typeof d.i === 'number' && chunk[d.i as number])
        .map((d) => ({ ...pickDetail(d), key: chunk[d.i as number]!.key, name_ja: chunk[d.i as number]!.name_ja }));
      send({ t: 'details', items: out });
      await cacheSetMany(out.map((d) => [d.name_ja, pickDetail(d)] as const));
    } catch { /* 이 묶음의 설명은 비워 둔다 */ }
  }));
};

/** 항목이 이만큼 넘을 때만 묶음을 정리한다. 적은 메뉴판은 묶지 않아도 한눈에 들어온다. 클라이언트 src/lib/groups.ts 의 같은 상수와 맞춘다 */
const MIN_ITEMS_FOR_GROUPS = 8;

/** 임시 group 들을 메뉴판 전체 기준으로 4~8개로 합친다. 실패하면 조용히 건너뛴다(클라이언트는 임시 group/category 로 묶는다) */
const runGroups = async (key: string, items: readonly Keyed[], send: (o: Line) => void, signal: AbortSignal): Promise<void> => {
  if (items.length < MIN_ITEMS_FOR_GROUPS) return;
  try {
    const payload = items.map((x, i) => ({ i, name_ja: x.name_ja, name_ko: x.name_ko, g: x.group }));
    const res = await fetch(UPSTREAM, { signal, method: 'POST', headers: headers(key), body: JSON.stringify(groupsBody(payload)) });
    if (!res.ok) return;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }>; stop_reason?: string };
    if (data.stop_reason === 'max_tokens') console.warn(`groups: 출력이 한도에서 잘림 (items=${items.length})`);
    const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
    const parsed = parseLoose(text) as { groups?: Array<{ name?: unknown; i?: unknown }> };
    if (!Array.isArray(parsed.groups)) return;
    const seen = new Set<string>();
    const groups = parsed.groups.flatMap((g) => {
      if (typeof g.name !== 'string' || !Array.isArray(g.i)) return [];
      const keys = g.i.filter((n): n is number => typeof n === 'number' && !!items[n]).map((n) => items[n]!.key).filter((k) => !seen.has(k) && (seen.add(k), true));
      return keys.length > 0 ? [{ name: g.name.trim().slice(0, 12), keys }] : [];
    });
    if (groups.length < 2) return;
    // 모델이 빠뜨린 항목은 메뉴판 순서상 바로 앞 항목의 묶음에 넣는다(이웃 = 같은 섹션일 확률이 높다). 맨 앞이 빠졌으면 첫 묶음
    const groupOf = new Map(groups.flatMap((g, gi) => g.keys.map((k) => [k, gi] as const)));
    let lastGi = 0;
    for (const it of items) {
      const gi = groupOf.get(it.key);
      if (gi === undefined) groups[lastGi]!.keys.push(it.key); else lastGi = gi;
    }
    send({ t: 'groups', groups });
  } catch { /* 묶음 없이 간다 */ }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  if (!isAllowed(codeFrom(req))) return errorJson('invalid access code', 401);

  const timelyKey = process.env.TIMELY_API_KEY;
  const upstageKey = process.env.UPSTAGE_API_KEY;
  if (!timelyKey) return errorJson('TIMELY_API_KEY is not configured', 500);

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.image) return errorJson('image is required', 400);
  const image = body.image;
  const mediaType = body.mediaType ?? 'image/jpeg';

  // 클라이언트가 홈으로 나가거나 사진을 빼서 요청을 끊으면 OCR·LLM 상류 호출도 같이 끊어 비용이 더 들지 않게 한다
  const signal = req.signal;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Line) => { if (!signal.aborted) controller.enqueue(line(obj)); };
      try {
        let ocr: OcrResult | null = null;
        if (upstageKey) {
          try {
            const r = await runOcr(image, mediaType, upstageKey, signal);
            if (r.words.length >= MIN_WORDS) ocr = r;
            send({ t: 'ocr', width: r.width, height: r.height, words: r.words, rotation: r.rotation, tilt: r.tilt, ms: r.ms, used: ocr !== null });
          } catch (e) {
            if (signal.aborted) throw e;
            send({ t: 'ocr', width: 1, height: 1, words: [], rotation: 0, tilt: 0, ms: 0, used: false, error: String(e) });
          }
        }
        const chunks: Array<readonly OcrWord[] | null> = ocr ? chunkWords(ocr.words) : [null];
        send({ t: 'mode', mode: ocr ? 'ocr' : 'image', chunks: chunks.length });

        // meta.kind 는 앞 묶음의 판정을 쓰므로 처리 중 kind 도 0번 묶음의 것만 보낸다 (묶음은 동시에 시작하니 늦어지지 않는다)
        const onKind = (k: string) => send({ t: 'kind', kind: k });
        const results = await Promise.all(chunks.map((c, i) => runStage1Chunk(timelyKey, i, c, image, mediaType, send, i === 0 ? onKind : () => {}, signal)));
        const first = results.find((r) => r.meta)?.meta ?? null;
        const notes = results.flatMap((r) => (Array.isArray(r.meta?.notes) ? r.meta!.notes! : []));
        send({ t: 'meta', kind: first?.kind ?? 'menu', shop_name: first?.shop_name ?? null, notes });
        const all = results.flatMap((r) => r.items);
        // 안내문·기타는 요리 설명(2단계)이 필요 없다. 생략하면 그만큼 빨리 끝난다
        if (all.length > 0 && (first?.kind ?? 'menu') === 'menu') await Promise.all([runStage2(timelyKey, all, send, signal), runGroups(timelyKey, all, send, signal)]);
        else if ((first?.kind ?? 'menu') !== 'menu') await runSummary(timelyKey, notes, send, signal);
        // 2단계 도중 끊기면 묶음별 catch 가 삼켜 여기까지 오므로, 중단된 스캔은 진단 저장도 하지 않는다
        if (signal.aborted) return;
        send({ t: 'done' });
        await saveDebug({ at: new Date().toISOString(), mode: ocr ? 'ocr' : 'image', width: ocr?.width ?? 0, height: ocr?.height ?? 0, rotation: ocr?.rotation ?? 0, tilt: ocr?.tilt ?? 0, words: ocr?.words ?? [], items: results.flatMap((r) => r.raw), notes, chunks: chunks.length }, image);
      } catch (e) {
        if (signal.aborted) console.info('[analyze] 클라이언트가 끊어 상류 호출을 중단함');
        else send({ t: 'error', m: e instanceof Error ? e.message : String(e) });
      } finally {
        try { controller.close(); } catch { /* 이미 닫힘 */ }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
};

export default { fetch: handler };
