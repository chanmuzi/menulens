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
 *   {"t":"lang","src":"ja"|"ko","dst":"ko"|"ja","currency":"JPY"|"KRW"}   원문 언어(OCR 문자 체계로 판정)와 앱 언어
 *   {"t":"mode","mode":"ocr"|"image","chunks":N}
 *   {"t":"kind","kind":"menu"|"sign"|"other"}               1단계 출력의 첫 키(kind)가 보이는 즉시 (한 번만)
 *   {"t":"item","key":"<묶음>:<순번>","item":{...}}         1단계 항목 하나 완성마다
 *   {"t":"note","key":"<묶음>:<순번>","note":{...}}         1단계 문구(안내문은 문단) 하나 완성마다. meta.notes 가 최종본
 *   {"t":"meta","kind","shop_name","title","notes":[...]}    1단계 모든 묶음 완료 후 (title: 「이모지 제목」, 기록 목록용)
 *   {"t":"details","items":[{key,kana?,pron,desc,tags,photo_query}],"cached"?}  캐시 적중분 먼저, 이후 2단계 묶음마다. pron 은 서버 규칙(가나→한글, 한글→가타카나)
 *   {"t":"groups","groups":[{name,keys:[key,...]}]}           메뉴판 묶음 정리(2단계와 병렬, 메뉴판일 때만)
 *   {"t":"summary","summary","tips":[...]}              안내문·기타 요약(meta 뒤 한 번, 문단이 있을 때만)
 *   {"t":"error","m":"...","code"?:"no_vision"|"ocr_failed"}  code 가 있으면 클라이언트가 그 코드의 문구를 쓴다(no_vision: 글자를 못 찾았는데 모델이 사진을 못 읽음, ocr_failed: OCR 호출 실패인데 모델이 사진을 못 읽음)
 *   {"t":"done"}
 */
import { codeFrom, isAllowed } from './_lib/access.js';
import { errorJson } from './_lib/http.js';
import { runOcr, type OcrResult, type OcrWord } from './_lib/ocr.js';
import { chunkWords } from './_lib/chunk.js';
import { createItemParser, parseLoose } from './_lib/itemStream.js';
import { cacheGetMany, cacheSetMany } from './_lib/cache.js';
import { saveDebug } from './_lib/debugStore.js';
import { groupsSystem, imageSystem, IMAGE_USER_PROMPT, stage1System, stage2System, summarySystem } from './_lib/prompt.js';
import { currencyOf, detectSrc, otherLang, parseLang, type Direction } from './_lib/direction.js';
import { kanaToHangul } from './_lib/kanaToHangul.js';
import { hangulToKana } from './_lib/hangulToKana.js';
import { llmStream, llmText, llmVision, resolveProvider, type LlmRequest } from './_lib/llm.js';

/** 이 수보다 단어가 적으면 OCR 을 믿지 않고 이미지 폴백 */
const MIN_WORDS = 3;
/** 2단계 병렬 호출 묶음 크기 */
const DETAIL_CHUNK = 10;

/** lang: 앱 언어(번역 대상). 없으면 ko(옛 클라이언트) */
type Body = { image?: string; mediaType?: string; lang?: unknown };
type Line = Record<string, unknown>;
type RawItem = Record<string, unknown>;
type Stage1 = { kind?: string; shop_name?: string | null; emoji?: string; title?: string; notes?: unknown[] };
/** 기록 목록용 자동 제목: 이모지와 제목을 한 줄로. 제목이 없으면 null(클라이언트가 옛 규칙으로 짓는다) */
const autoTitle = (m: Stage1 | null): string | null => {
  const title = typeof m?.title === 'string' ? m.title.trim().slice(0, 24) : '';
  if (!title) return null;
  // 이모지는 글자(그래핌) 하나만: ZWJ 이모지를 코드 유닛으로 자르면 깨지고, 「🍺🍢」처럼 여러 개가 와도 하나만 남긴다
  const emoji = typeof m?.emoji === 'string' ? ([...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(m.emoji.trim())][0]?.segment ?? '') : '';
  return emoji ? `${emoji} ${title}` : title;
};
type Keyed = { key: string; name: string; tr: string; group: string };

const enc = new TextEncoder();
const line = (obj: Line): Uint8Array => enc.encode(JSON.stringify(obj) + '\n');
/** LLM 요청은 모두 _lib/llm 의 한 형태로 쓴다(제공자별 형식 변환은 거기서). 사고는 짧게(think 기본 'low') */
const stage1Body = (d: Direction, words: readonly OcrWord[] | null, image: string, mediaType: string): LlmRequest => ({
  maxTokens: 6000,
  system: words ? stage1System(d) : imageSystem(d),
  messages: [{
    role: 'user',
    content: words
      ? [{ type: 'text', text: '단어 목록:\n' + JSON.stringify(words) }]
      : [{ type: 'image', mediaType, data: image }, { type: 'text', text: IMAGE_USER_PROMPT }],
  }],
});

const stage2Body = (d: Direction, chunk: ReadonlyArray<{ i: number; name: string; tr: string }>): LlmRequest => ({
  maxTokens: 2500, system: stage2System(d),
  messages: [{ role: 'user', content: JSON.stringify(chunk) }],
});

const groupsBody = (d: Direction, items: ReadonlyArray<{ i: number; name: string; tr: string; g: string }>): LlmRequest => ({
  // 메뉴판 전체를 한 번에 받으므로 한도는 항목 수에 비례(번호 배열 ≈ 항목당 5토큰 + 생각 토큰). 잘리면 묶음 정리가 조용히 빠진다
  maxTokens: Math.min(4000, 1500 + items.length * 15), system: groupsSystem(d),
  messages: [{ role: 'user', content: JSON.stringify(items) }],
});

const summaryBody = (d: Direction, notes: ReadonlyArray<{ text: string; tr: string }>): LlmRequest => ({
  maxTokens: 1500, system: summarySystem(d),
  messages: [{ role: 'user', content: JSON.stringify(notes) }],
});

/** 1단계 한 묶음: 스트리밍하며 항목을 즉시 전송하고, 끝나면 메타와 항목 목록을 돌려준다 */
const KIND_RE = /"kind"\s*:\s*"(menu|sign|other)"/;

const runStage1Chunk = async (d: Direction, chunkIndex: number, words: readonly OcrWord[] | null, image: string, mediaType: string, send: (o: Line) => void, onKind: (k: string) => void, signal: AbortSignal): Promise<{ meta: Stage1 | null; items: Keyed[]; raw: RawItem[] }> => {
  const parser = createItemParser();
  // 안내문은 items 가 비고 notes(문단)가 본문이라, 문단도 완성되는 즉시 보내 덮개가 위에서부터 차례로 뜨게 한다
  const noteParser = createItemParser('notes');
  const streamedNotes: unknown[] = [];
  const items: Keyed[] = [];
  const rawItems: RawItem[] = [];
  let kindSeen = false;
  await llmStream(stage1Body(d, words, image, mediaType), (d) => {
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
      items.push({ key: k, name: typeof it.name === 'string' ? it.name : '', tr: typeof it.tr === 'string' ? it.tr : '', group: typeof it.group === 'string' ? it.group : '' });
      rawItems.push({ ...it, key: k });
      send({ t: 'item', key: k, item: it });
    }
  }, { signal });
  let meta: Stage1 | null = null;
  try { meta = parseLoose(parser.text()) as Stage1; } catch { meta = null; }
  // 출력이 잘리거나 꼬리가 깨져 전체 파싱에 실패해도, 이미 보낸 문단은 meta 에 남겨 화면에서 사라지지 않게 한다
  if (streamedNotes.length > 0 && !(Array.isArray(meta?.notes) && meta.notes.length >= streamedNotes.length)) meta = { ...(meta ?? {}), notes: streamedNotes };
  return { meta, items, raw: rawItems };
};

/** 안내문·기타 요약. 실패하면 요약 없이 끝난다(덮개·번역문은 이미 보냈다) */
const runSummary = async (d: Direction, notes: readonly unknown[], send: (o: Line) => void, signal: AbortSignal): Promise<void> => {
  const payload = notes.flatMap((n) => {
    const r = (typeof n === 'object' && n !== null ? n : {}) as Record<string, unknown>;
    return typeof r.text === 'string' && r.text ? [{ text: r.text, tr: typeof r.tr === 'string' ? r.tr : '' }] : [];
  });
  if (payload.length === 0) return;
  try {
    const { text, truncated } = await llmText(summaryBody(d, payload), { signal });
    if (truncated) console.warn(`summary: 출력이 한도에서 잘림 (notes=${payload.length})`);
    const parsed = parseLoose(text) as { summary?: unknown; tips?: unknown };
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const tips = Array.isArray(parsed.tips) ? parsed.tips.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, 2) : [];
    if (summary) send({ t: 'summary', summary: summary, tips: tips });
  } catch { /* 요약 없이 끝낸다 */ }
};

/** 캐시에 두는 것은 모델 출력뿐. 발음(pron)은 보낼 때마다 규칙으로 만들어 규칙이 바뀌면 캐시된 메뉴에도 바로 반영된다 */
const DETAIL_FIELDS = ['kana', 'desc', 'tags', 'photo_query'] as const;
const pickDetail = (d: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(DETAIL_FIELDS.filter((f) => f in d).map((f) => [f, d[f]]));
/**
 * 발음은 모델이 짓지 않는다. 일본어 원문은 모델이 낸 읽기(kana)를 규칙으로 한글로 옮기고(가나가 아니면 비운다),
 * 한국어 원문은 이름 자체를 규칙으로 가타카나로 옮긴다. 원문과 앱 언어가 같으면 발음이 필요 없다.
 */
const withPron = (dir: Direction, name: string, d: Record<string, unknown>): Record<string, unknown> => {
  if (dir.src === dir.dst) return { ...d, pron: '' };
  if (dir.src === 'ja') return { ...d, pron: typeof d.kana === 'string' ? kanaToHangul(d.kana) : '' };
  // 「(1인분 180g)」 같은 괄호 단위는 읽을 필요가 없다
  return { ...d, pron: hangulToKana(name.replace(/[(（][^)）]*[)）]/g, ' ').replace(/\s+/g, ' ').trim()) };
};

const runStage2 = async (d: Direction, items: readonly Keyed[], send: (o: Line) => void, signal: AbortSignal): Promise<void> => {
  // 캐시에 있는 메뉴는 즉시 보내고, 나머지만 LLM 에 묻는다(캐시는 방향별)
  const fetched = await cacheGetMany(d, items.filter((x) => x.name).map((x) => x.name));
  // 2026-10-31 이전에 쌓인 일→한 항목에는 읽기(kana)가 없고 모델이 지은 발음만 있다. 그런 항목은 적중으로 치지 않고 다시 받아 규칙 발음으로 바꿔 간다(사용 빈도만큼 자연 이전)
  const usable = (c: Record<string, unknown>): boolean => d.src !== 'ja' || d.src === d.dst || typeof c.kana === 'string';
  const cached = new Map([...fetched].filter(([, c]) => usable(c)));
  const hits = items.filter((x) => cached.has(x.name)).map((x) => ({ ...withPron(d, x.name, pickDetail(cached.get(x.name)!)), key: x.key }));
  if (hits.length > 0) send({ t: 'details', items: hits, cached: true });
  const named = items.filter((x) => x.name && !cached.has(x.name));
  const chunks: Keyed[][] = [];
  for (let i = 0; i < named.length; i += DETAIL_CHUNK) chunks.push(named.slice(i, i + DETAIL_CHUNK));
  await Promise.all(chunks.map(async (chunk) => {
    try {
      const payload = chunk.map((x, i) => ({ i, name: x.name, tr: x.tr }));
      const { text } = await llmText(stage2Body(d, payload), { signal });
      const parsed = parseLoose(text) as { details?: Array<Record<string, unknown>> };
      if (!Array.isArray(parsed.details)) return;
      const out = parsed.details
        .filter((d) => typeof d.i === 'number' && chunk[d.i as number])
        .map((x) => { const name = chunk[x.i as number]!.name; return { ...withPron(d, name, pickDetail(x)), key: chunk[x.i as number]!.key, name }; });
      send({ t: 'details', items: out });
      await cacheSetMany(d, out.map((x) => [x.name, pickDetail(x)] as const));
    } catch { /* 이 묶음의 설명은 비워 둔다 */ }
  }));
};

/** 항목이 이만큼 넘을 때만 묶음을 정리한다. 적은 메뉴판은 묶지 않아도 한눈에 들어온다. 클라이언트 src/lib/groups.ts 의 같은 상수와 맞춘다 */
const MIN_ITEMS_FOR_GROUPS = 8;

/** 임시 group 들을 메뉴판 전체 기준으로 4~8개로 합친다. 실패하면 조용히 건너뛴다(클라이언트는 임시 group/category 로 묶는다) */
const runGroups = async (d: Direction, items: readonly Keyed[], send: (o: Line) => void, signal: AbortSignal): Promise<void> => {
  if (items.length < MIN_ITEMS_FOR_GROUPS) return;
  try {
    const payload = items.map((x, i) => ({ i, name: x.name, tr: x.tr, g: x.group }));
    const { text, truncated } = await llmText(groupsBody(d, payload), { signal });
    if (truncated) console.warn(`groups: 출력이 한도에서 잘림 (items=${items.length})`);
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

  const upstageKey = process.env.UPSTAGE_API_KEY;
  // 제공자 미설정은 스트림을 열기 전에 500 으로 알린다
  try { resolveProvider(); } catch (e) { return errorJson(e instanceof Error ? e.message : String(e), 500); }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.image) return errorJson('image is required', 400);
  const image = body.image;
  const mediaType = body.mediaType ?? 'image/jpeg';
  const dst = parseLang(body.lang);

  // 클라이언트가 홈으로 나가거나 사진을 빼서 요청을 끊으면 OCR·LLM 상류 호출도 같이 끊어 비용이 더 들지 않게 한다
  const signal = req.signal;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Line) => { if (!signal.aborted) controller.enqueue(line(obj)); };
      try {
        let ocr: OcrResult | null = null;
        let ocrFailed = false;
        if (upstageKey) {
          try {
            const r = await runOcr(image, mediaType, upstageKey, signal);
            if (r.words.length >= MIN_WORDS) ocr = r;
            send({ t: 'ocr', width: r.width, height: r.height, words: r.words, rotation: r.rotation, tilt: r.tilt, ms: r.ms, used: ocr !== null });
          } catch (e) {
            if (signal.aborted) throw e;
            ocrFailed = true;
            send({ t: 'ocr', width: 1, height: 1, words: [], rotation: 0, tilt: 0, ms: 0, used: false, error: String(e) });
          }
        }
        // OCR 이 글자를 못 찾으면 이미지를 직접 보는 폴백인데, 글자만 받는 모델(Solar 등)이면 여기서 끝낸다(클라이언트가 code 로 문구를 고른다).
        // OCR 호출 자체가 실패한 것(상류 장애)은 사진 탓이 아니므로 다른 코드로 알린다
        if (!ocr && !llmVision()) {
          send(ocrFailed ? { t: 'error', code: 'ocr_failed', m: 'ocr failed and the model cannot read images' } : { t: 'error', code: 'no_vision', m: 'no text found and the model cannot read images' });
          return;
        }
        // 원문 언어는 OCR 단어의 문자 체계로. OCR 을 못 썼으면 앱 언어의 반대(한국어 UI 는 일본 사진, 일본어 UI 는 한국 사진)
        const src = ocr ? detectSrc(ocr.words, dst) : otherLang(dst);
        const dir: Direction = { src, dst };
        send({ t: 'lang', src, dst, currency: currencyOf(src) });
        const chunks: Array<readonly OcrWord[] | null> = ocr ? chunkWords(ocr.words) : [null];
        send({ t: 'mode', mode: ocr ? 'ocr' : 'image', chunks: chunks.length });

        // meta.kind 는 앞 묶음의 판정을 쓰므로 처리 중 kind 도 0번 묶음의 것만 보낸다 (묶음은 동시에 시작하니 늦어지지 않는다)
        const onKind = (k: string) => send({ t: 'kind', kind: k });
        const results = await Promise.all(chunks.map((c, i) => runStage1Chunk(dir, i, c, image, mediaType, send, i === 0 ? onKind : () => {}, signal)));
        const first = results.find((r) => r.meta)?.meta ?? null;
        const notes = results.flatMap((r) => (Array.isArray(r.meta?.notes) ? r.meta!.notes! : []));
        send({ t: 'meta', kind: first?.kind ?? 'menu', shop_name: first?.shop_name ?? null, title: autoTitle(first), notes });
        const all = results.flatMap((r) => r.items);
        // 안내문·기타는 요리 설명(2단계)이 필요 없다. 생략하면 그만큼 빨리 끝난다
        if (all.length > 0 && (first?.kind ?? 'menu') === 'menu') await Promise.all([runStage2(dir, all, send, signal), runGroups(dir, all, send, signal)]);
        else if ((first?.kind ?? 'menu') !== 'menu') await runSummary(dir, notes, send, signal);
        // 2단계 도중 끊기면 묶음별 catch 가 삼켜 여기까지 오므로, 중단된 스캔은 진단 저장도 하지 않는다
        if (signal.aborted) return;
        send({ t: 'done' });
        await saveDebug({ at: new Date().toISOString(), lang: dir, mode: ocr ? 'ocr' : 'image', width: ocr?.width ?? 0, height: ocr?.height ?? 0, rotation: ocr?.rotation ?? 0, tilt: ocr?.tilt ?? 0, words: ocr?.words ?? [], items: results.flatMap((r) => r.raw), notes, chunks: chunks.length }, image);
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
