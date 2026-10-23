/**
 * POST /api/talk — 대화 통역의 글자 쪽(번역·도우미·제목). Claude 는 Timely 가 기본, 한도 문제면 Anthropic 직접 키(_lib/claude).
 * - { mode:'translate', text, turns } → NDJSON { t:'field', k, v }(필드가 완성되는 대로) … { t:'done', result, via } | { t:'error', m }
 * - { mode:'ask', turns, history, question } → NDJSON { t:'delta', text } … { t:'done', text, via } | { t:'error', m }
 * - { mode:'title', turns } → { title }
 * turns 는 앞선 대화 [{ who:'me'|'them', src, tr }] (최근 것만 잘라 보낸다)
 */
import { codeFrom, isAllowed } from './_lib/access.js';
import { errorJson, json } from './_lib/http.js';
import { MODEL } from './_lib/prompt.js';
import { callClaude, readSse } from './_lib/claude.js';
import { ASK_SYSTEM, TITLE_SYSTEM, TRANSLATE_SYSTEM } from './_lib/talkPrompt.js';

type Turn = { who: 'me' | 'them'; src: string; tr: string };
type Body = { mode?: string; text?: string; question?: string; turns?: unknown; history?: unknown };

const MAX_TEXT = 500;
const enc = new TextEncoder();
const line = (o: Record<string, unknown>): Uint8Array => enc.encode(JSON.stringify(o) + '\n');
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

const toTurns = (v: unknown, keep: number): readonly Turn[] =>
  (Array.isArray(v) ? v : []).slice(-keep).map((t) => {
    const r = (t ?? {}) as Record<string, unknown>;
    return { who: r.who === 'them' ? 'them' as const : 'me' as const, src: str(r.src, 300), tr: str(r.tr, 300) };
  }).filter((t) => t.src);

const transcript = (turns: readonly Turn[]): string =>
  turns.map((t) => `${t.who === 'me' ? '나' : '상대'}: ${t.src}${t.tr ? ` → ${t.tr}` : ''}`).join('\n') || '(아직 없음)';

/** 누적된 JSON 글자에서 값이 닫힌 문자열 필드만 뽑는다(스트리밍 중 완성된 것부터 화면에 올리기 위해) */
const FIELD = /"([a-z]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
const closedFields = (text: string): ReadonlyArray<readonly [string, string]> =>
  [...text.matchAll(FIELD)].map((m) => {
    let v = m[2]!;
    try { v = JSON.parse(`"${m[2]}"`) as string; } catch { /* 이스케이프가 깨졌으면 원문 그대로 */ }
    return [m[1]!, v] as const;
  });

/** NDJSON 스트림 응답. 클라이언트가 끊으면 상류 생성도 멈춘다(req.signal) */
const stream = (run: (send: (o: Record<string, unknown>) => void) => Promise<void>, signal: AbortSignal): Response =>
  new Response(new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: Record<string, unknown>) => controller.enqueue(line(o));
      try { await run(send); } catch (e) {
        if (signal.aborted) return;
        try { send({ t: 'error', m: e instanceof Error ? e.message : String(e) }); } catch { /* 이미 닫힘 */ }
      }
      try { controller.close(); } catch { /* 이미 닫힘 */ }
    },
  }), { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });

const upstream = async (body: unknown, signal: AbortSignal) => {
  const r = await callClaude(body, signal);
  if (!r.res.ok || !r.res.body) {
    // 상류 오류 본문(조직·요청 id 등)은 서버 로그에만 남기고 클라이언트에는 상태 코드만 준다(chat.ts 와 같게)
    console.error('[talk] upstream', r.via, r.res.status, (await r.res.text().catch(() => '')).slice(0, 300));
    throw new Error(`upstream ${r.res.status}`);
  }
  return r;
};

const translate = (b: Body, signal: AbortSignal): Response => {
  const text = str(b.text, MAX_TEXT);
  if (!text) return errorJson('text is required', 400);
  const turns = toTurns(b.turns, 4);
  return stream(async (send) => {
    const r = await upstream({
      model: MODEL, stream: true, max_tokens: 800, thinking: { type: 'between_tools' }, system: TRANSLATE_SYSTEM,
      messages: [{ role: 'user', content: `앞선 대화:\n${transcript(turns)}\n\n입력: ${text}` }],
    }, signal);
    let full = '';
    const sent = new Set<string>();
    await readSse(r.res.body!, (t) => {
      full += t;
      for (const [k, v] of closedFields(full)) if (!sent.has(k)) { sent.add(k); send({ t: 'field', k, v }); }
    });
    const result = JSON.parse(full.replace(/^```(?:json)?\s*|```\s*$/g, '').trim()) as Record<string, unknown>;
    send({ t: 'done', result, via: r.via });
  }, signal);
};

const ask = (b: Body, signal: AbortSignal): Response => {
  const question = str(b.question, 300);
  if (!question) return errorJson('question is required', 400);
  const turns = toTurns(b.turns, 20);
  const prior = (Array.isArray(b.history) ? b.history : []).slice(-6).map((m) => {
    const r = (m ?? {}) as Record<string, unknown>;
    return { role: r.role === 'bot' ? 'assistant' as const : 'user' as const, content: str(r.text, 600) };
  }).filter((m) => m.content);
  // 대화는 user 턴으로 시작해야 한다
  const start = prior.findIndex((m) => m.role === 'user');
  const history = start < 0 ? [] : prior.slice(start);
  return stream(async (send) => {
    const r = await upstream({
      model: MODEL, stream: true, max_tokens: 700, thinking: { type: 'adaptive' }, output_config: { effort: 'low' }, system: ASK_SYSTEM,
      messages: [...history, { role: 'user', content: `대화 기록:\n${transcript(turns)}\n\n질문: ${question}` }],
    }, signal);
    let full = '';
    await readSse(r.res.body!, (t) => { full += t; send({ t: 'delta', text: t }); });
    send({ t: 'done', text: full.trim(), via: r.via });
  }, signal);
};

const title = async (b: Body, signal: AbortSignal): Promise<Response> => {
  const turns = toTurns(b.turns, 12);
  if (turns.length === 0) return errorJson('turns are required', 400);
  const r = await callClaude({ model: MODEL, max_tokens: 80, thinking: { type: 'between_tools' }, system: TITLE_SYSTEM, messages: [{ role: 'user', content: transcript(turns) }] }, signal);
  if (!r.res.ok) return errorJson(`upstream ${r.res.status}`, 502);
  const data = (await r.res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('').trim().split('\n')[0] ?? '';
  return json({ title: text.slice(0, 40) || null });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  if (!isAllowed(codeFrom(req))) return errorJson('invalid access code', 401);
  const b = (await req.json().catch(() => ({}))) as Body;
  try {
    if (b.mode === 'translate') return translate(b, req.signal);
    if (b.mode === 'ask') return ask(b, req.signal);
    if (b.mode === 'title') return await title(b, req.signal);
    return errorJson('unknown mode', 400);
  } catch (e) {
    return errorJson(e instanceof Error ? e.message : String(e), 500);
  }
};

export default { fetch: handler };
