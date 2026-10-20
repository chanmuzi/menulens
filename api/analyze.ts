/**
 * POST /api/analyze  { image: base64, mediaType }
 *
 * 파이프라인 (docs/benchmarks.md):
 *   1) Upstage OCR → 단어·좌표·글자 방향 (≈2~4초). 결과를 먼저 클라이언트에 보낸다.
 *   2) 1단계 LLM: 단어 목록 → 항목(이름·가격·좌표·아이콘)만 짧게. 단어가 많으면 읽기 순서대로 묶어 병렬 호출.
 *      항목은 서버에서 파싱해 완성되는 즉시 보낸다.
 *   3) 2단계 LLM: 항목 10개씩 병렬로 발음·설명·태그를 받아 뒤따라 보낸다.
 * OCR 이 단어를 거의 못 읽으면 이미지를 직접 보는 폴백으로 간다 (2단계는 동일).
 *
 * 응답은 줄 단위 JSON (NDJSON):
 *   {"t":"ocr","width","height","words":[{id,t,box}],"rotation","tilt","ms","used"}
 *   {"t":"mode","mode":"ocr"|"image","chunks":N}
 *   {"t":"item","key":"<묶음>:<순번>","item":{...}}         1단계 항목 하나 완성마다
 *   {"t":"meta","kind","shop_name","notes":[...]}            1단계 모든 묶음 완료 후
 *   {"t":"details","items":[{key,pron_ko,desc_ko,tags,photo_query}],"cached"?}  캐시 적중분 먼저, 이후 2단계 묶음마다
 *   {"t":"error","m":"..."}
 *   {"t":"done"}
 */
import { codeFrom, isAllowed } from './_lib/access';
import { errorJson } from './_lib/http';
import { runOcr, type OcrResult, type OcrWord } from './_lib/ocr';
import { chunkWords } from './_lib/chunk';
import { createItemParser, parseLoose } from './_lib/itemStream';
import { cacheGetMany, cacheSetMany } from './_lib/cache';
import { IMAGE_SYSTEM, IMAGE_USER_PROMPT, MODEL, STAGE1_SYSTEM, STAGE2_SYSTEM } from './_lib/prompt';

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://api.timelyrouter.ai/v1/messages';
/** 이 수보다 단어가 적으면 OCR 을 믿지 않고 이미지 폴백 */
const MIN_WORDS = 3;
/** 2단계 병렬 호출 묶음 크기 */
const DETAIL_CHUNK = 10;

type Body = { image?: string; mediaType?: string };
type Line = Record<string, unknown>;
type RawItem = Record<string, unknown>;
type Stage1 = { kind?: string; shop_name?: string | null; notes?: unknown[] };
type Keyed = { key: string; name_ja: string; name_ko: string };

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
const runStage1Chunk = async (key: string, chunkIndex: number, words: readonly OcrWord[] | null, image: string, mediaType: string, send: (o: Line) => void): Promise<{ meta: Stage1 | null; items: Keyed[] }> => {
  const res = await fetch(UPSTREAM, { method: 'POST', headers: headers(key), body: JSON.stringify(stage1Body(words, image, mediaType)) });
  if (!res.ok || !res.body) throw new Error(`upstream ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
  const parser = createItemParser();
  const items: Keyed[] = [];
  await readSse(res.body, (d) => {
    for (const raw of parser.push(d)) {
      if (typeof raw !== 'object' || raw === null) continue;
      const it = raw as RawItem;
      const k = `${chunkIndex}:${items.length}`;
      items.push({ key: k, name_ja: typeof it.name_ja === 'string' ? it.name_ja : '', name_ko: typeof it.name_ko === 'string' ? it.name_ko : '' });
      send({ t: 'item', key: k, item: it });
    }
  });
  let meta: Stage1 | null = null;
  try { meta = parseLoose(parser.text()) as Stage1; } catch { meta = null; }
  return { meta, items };
};

const DETAIL_FIELDS = ['pron_ko', 'desc_ko', 'tags', 'photo_query'] as const;
const pickDetail = (d: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(DETAIL_FIELDS.filter((f) => f in d).map((f) => [f, d[f]]));

const runStage2 = async (key: string, items: readonly Keyed[], send: (o: Line) => void): Promise<void> => {
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
      const res = await fetch(UPSTREAM, { method: 'POST', headers: headers(key), body: JSON.stringify(stage2Body(payload)) });
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  if (!isAllowed(codeFrom(req))) return errorJson('invalid access code', 401);

  const timelyKey = process.env.TIMELY_API_KEY;
  const upstageKey = process.env.UPSTAGE_API_KEY;
  if (!timelyKey) return errorJson('TIMELY_API_KEY is not configured', 500);

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.image) return errorJson('image is required', 400);
  const image = body.image;
  const mediaType = body.mediaType ?? 'image/jpeg';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Line) => controller.enqueue(line(obj));
      try {
        let ocr: OcrResult | null = null;
        if (upstageKey) {
          try {
            const r = await runOcr(image, mediaType, upstageKey);
            if (r.words.length >= MIN_WORDS) ocr = r;
            send({ t: 'ocr', width: r.width, height: r.height, words: r.words, rotation: r.rotation, tilt: r.tilt, ms: r.ms, used: ocr !== null });
          } catch (e) {
            send({ t: 'ocr', width: 1, height: 1, words: [], rotation: 0, tilt: 0, ms: 0, used: false, error: String(e) });
          }
        }
        const chunks: Array<readonly OcrWord[] | null> = ocr ? chunkWords(ocr.words) : [null];
        send({ t: 'mode', mode: ocr ? 'ocr' : 'image', chunks: chunks.length });

        const results = await Promise.all(chunks.map((c, i) => runStage1Chunk(timelyKey, i, c, image, mediaType, send)));
        const first = results.find((r) => r.meta)?.meta ?? null;
        const notes = results.flatMap((r) => (Array.isArray(r.meta?.notes) ? r.meta!.notes! : []));
        send({ t: 'meta', kind: first?.kind ?? 'menu', shop_name: first?.shop_name ?? null, notes });
        const all = results.flatMap((r) => r.items);
        if (all.length > 0) await runStage2(timelyKey, all, send);
        send({ t: 'done' });
      } catch (e) {
        send({ t: 'error', m: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' },
  });
}
