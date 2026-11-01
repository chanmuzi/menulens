/**
 * POST /api/talk — 대화 통역의 글자 쪽(번역·도우미·제목). LLM 은 _lib/llm 의 제공자. 기본이 Timely 이고 한도 문제면 Anthropic 직접 키로 한 번 더(fallback).
 * - { mode:'translate', text, turns } → NDJSON { t:'field', k, v }(필드가 완성되는 대로) … { t:'done', result, via } | { t:'error', m }
 * - { mode:'ask', turns, history, question } → NDJSON { t:'delta', text } … { t:'done', text, via } | { t:'error', m }
 * - { mode:'title', turns } → { title }
 * turns 는 앞선 대화 [{ who:'me'|'them', src, tr }] (최근 것만 잘라 보낸다). lang {me} 는 대화의 내 언어(앱 언어), 없으면 ko.
 * 발음(pron)은 모델이 아니라 규칙으로: 상대 언어가 일본어면 kana → 한글(kanaToHangul), 한국어면 번역문 → 가타카나(hangulToKana). 도우미의 「말해 볼 문장」 발음도 같다.
 */
import { codeFrom, isAllowed } from './_lib/access.js';
import { errorJson, json } from './_lib/http.js';
import { llmStream, llmText, type LlmRequest } from './_lib/llm.js';
import { askSystem, titleSystem, translateSystem } from './_lib/talkPrompt.js';
import { parseTalkDirection, type TalkDirection } from './_lib/direction.js';
import { pronOf, sayWithPron, stripSayPron } from './_lib/talkPron.js';

type Turn = { who: 'me' | 'them'; src: string; tr: string };
type Body = { mode?: string; text?: string; question?: string; turns?: unknown; history?: unknown; lang?: unknown };

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

/** 상류 오류 본문은 _lib/llm 이 서버 로그에만 남기고 클라이언트에는 상태 코드만 간다(UpstreamError) */
const stream_ = (r: LlmRequest, onText: (t: string) => void, signal: AbortSignal) => llmStream(r, onText, { signal, fallback: true });

const translate = (b: Body, d: TalkDirection, signal: AbortSignal): Response => {
  const text = str(b.text, MAX_TEXT);
  if (!text) return errorJson('text is required', 400);
  const turns = toTurns(b.turns, 4);
  return stream(async (send) => {
    let full = '';
    const sent = new Set<string>();
    // 짧은 구조화 출력이라 생각 없이(think off)
    const r = await stream_({
      maxTokens: 800, think: 'off', system: translateSystem(d),
      messages: [{ role: 'user', content: `앞선 대화:\n${transcript(turns)}\n\n입력: ${text}` }],
    }, (t) => {
      full += t;
      // 모델이 pron 을 내더라도 흘리지 않는다(발음은 아래에서 규칙으로)
      for (const [k, v] of closedFields(full)) if (k !== 'pron' && !sent.has(k)) { sent.add(k); send({ t: 'field', k, v }); }
    }, signal);
    const parsed = JSON.parse(full.replace(/^```(?:json)?\s*|```\s*$/g, '').trim()) as Record<string, unknown>;
    // 내 말(상대 언어로 번역된 것)에만 발음을 붙인다. 상대 말은 내가 읽기만 하면 된다
    const mine = parsed.lang !== d.them;
    const pron = mine ? pronOf(d, str(parsed[d.them], MAX_TEXT), str(parsed.kana, MAX_TEXT)) : '';
    if (pron) send({ t: 'field', k: 'pron', v: pron });
    send({ t: 'done', result: { ...parsed, pron }, via: r.via });
  }, signal);
};

const ask = (b: Body, d: TalkDirection, signal: AbortSignal): Response => {
  const question = str(b.question, 300);
  if (!question) return errorJson('question is required', 400);
  const turns = toTurns(b.turns, 20);
  const prior = (Array.isArray(b.history) ? b.history : []).slice(-6).map((m) => {
    const r = (m ?? {}) as Record<string, unknown>;
    // 앱이 붙인 발음 괄호는 떼고 보낸다(모델이 그 형식을 따라 괄호에 한글을 쓰면 규칙 변환이 안 된다)
    return { role: r.role === 'bot' ? 'assistant' as const : 'user' as const, content: r.role === 'bot' ? stripSayPron(str(r.text, 600)) : str(r.text, 600) };
  }).filter((m) => m.content);
  // 대화는 user 턴으로 시작해야 한다
  const start = prior.findIndex((m) => m.role === 'user');
  const history = start < 0 ? [] : prior.slice(start);
  return stream(async (send) => {
    let full = '';
    const r = await stream_({
      maxTokens: 700, system: askSystem(d),
      messages: [...history, { role: 'user', content: `대화 기록:\n${transcript(turns)}\n\n질문: ${question}` }],
    }, (t) => { full += t; send({ t: 'delta', text: t }); }, signal);
    send({ t: 'done', text: sayWithPron(full, d), via: r.via });
  }, signal);
};

const title = async (b: Body, d: TalkDirection, signal: AbortSignal): Promise<Response> => {
  const turns = toTurns(b.turns, 12);
  if (turns.length === 0) return errorJson('turns are required', 400);
  let out: string;
  try {
    const r = await llmText({ maxTokens: 80, think: 'off', system: titleSystem(d), messages: [{ role: 'user', content: transcript(turns) }] }, { signal, fallback: true });
    // 제목이 비어 나가면 원인이 안 보이므로 한도에서 잘린 것은 로그에 남긴다(OpenAI 형식은 추론 토큰도 max_completion_tokens 안에서 센다)
    if (r.truncated) console.warn(`[talk] title: 출력이 한도에서 잘림 (via=${r.via}, turns=${turns.length})`);
    out = r.text;
  } catch (e) { return errorJson(e instanceof Error ? e.message : String(e), 502); }
  const text = out.trim().split('\n')[0] ?? '';
  return json({ title: text.slice(0, 40) || null });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  if (!isAllowed(codeFrom(req))) return errorJson('invalid access code', 401);
  const b = (await req.json().catch(() => ({}))) as Body;
  const d = parseTalkDirection(b.lang);
  try {
    if (b.mode === 'translate') return translate(b, d, req.signal);
    if (b.mode === 'ask') return ask(b, d, req.signal);
    if (b.mode === 'title') return await title(b, d, req.signal);
    return errorJson('unknown mode', 400);
  } catch (e) {
    return errorJson(e instanceof Error ? e.message : String(e), 500);
  }
};

export default { fetch: handler };
