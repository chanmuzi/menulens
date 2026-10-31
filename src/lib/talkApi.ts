/** 대화 통역 서버 호출: 음성 인식(/api/stt), 번역·도우미·제목(/api/talk, NDJSON) */
import type { TalkWho } from '../types';
import { getAccessCode } from './storage';
import { readNdjson } from './ndjson';
import { dict } from '../i18n';
import { ApiError, emptyResponseError } from './apiError';

type Ctx = ReadonlyArray<{ who: TalkWho; src: string; tr: string }>;

/** 음성 인식을 쓸 수 없음. retryAfter 는 한도 때문에 다시 될 때까지의 초(모르면 null) */
export class SttUnavailableError extends Error {
  readonly retryAfter: number | null;
  constructor(retryAfter: number | null) { super('stt_unavailable'); this.retryAfter = retryAfter; }
}

const code = (): string => getAccessCode() ?? '';
const failure = (status: number): Error => new ApiError(status);

export const transcribe = async (audio: Blob, lang: 'ko' | 'ja', signal?: AbortSignal): Promise<string> => {
  const res = await fetch('/api/stt', {
    method: 'POST', signal, body: audio,
    headers: { 'content-type': audio.type.split(';')[0] || 'audio/mp4', 'x-lang': lang, 'x-access-code': code() },
  });
  if (res.status === 503) {
    const data = (await res.json().catch(() => ({}))) as { retryAfter?: unknown };
    throw new SttUnavailableError(typeof data.retryAfter === 'number' ? data.retryAfter : null);
  }
  if (!res.ok) throw failure(res.status);
  return ((await res.json()) as { text?: string }).text?.trim() ?? '';
};

/** /api/talk 스트림. error 이벤트는 예외로 */
const readLines = async (res: Response, onEvent: (ev: Record<string, unknown>) => void): Promise<void> => {
  if (!res.ok) throw failure(res.status);
  if (!res.body) throw emptyResponseError();
  await readNdjson<Record<string, unknown>>(res.body, (ev) => {
    if (ev.t === 'error') throw new Error(typeof ev.m === 'string' ? ev.m : dict().talk.responseError);
    onEvent(ev);
  });
};

const post = (body: unknown, signal?: AbortSignal): Promise<Response> =>
  fetch('/api/talk', { method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-access-code': code() }, body: JSON.stringify(body) });

/** 번역. 필드가 완성되는 대로 onFields(지금까지 받은 필드 전부), 끝나면 최종 결과 */
export const translate = async (text: string, turns: Ctx, onFields: (f: Readonly<Record<string, unknown>>) => void, signal?: AbortSignal): Promise<Readonly<Record<string, unknown>>> => {
  const res = await post({ mode: 'translate', text, turns: turns.slice(-4) }, signal);
  let fields: Record<string, unknown> = {};
  let result: Record<string, unknown> | null = null;
  await readLines(res, (ev) => {
    if (ev.t === 'field' && typeof ev.k === 'string') { fields = { ...fields, [ev.k]: ev.v }; onFields(fields); }
    else if (ev.t === 'done' && ev.result && typeof ev.result === 'object') result = ev.result as Record<string, unknown>;
  });
  if (!result) throw new Error(dict().talk.translationCut);
  return result;
};

/** 도우미. 글자가 오는 대로 onText(누적), 끝나면 전체 */
export const askHelper = async (question: string, turns: Ctx, history: ReadonlyArray<{ role: 'me' | 'bot'; text: string }>, onText: (t: string) => void, signal?: AbortSignal): Promise<string> => {
  const res = await post({ mode: 'ask', question, turns: turns.slice(-20), history: history.slice(-6) }, signal);
  let text = '';
  let final: string | null = null;
  await readLines(res, (ev) => {
    if (ev.t === 'delta' && typeof ev.text === 'string') { text += ev.text; onText(text); }
    else if (ev.t === 'done' && typeof ev.text === 'string') final = ev.text;
  });
  if (final === null) throw new Error(dict().talk.answerCut);
  return final;
};

export const fetchTitle = async (turns: Ctx): Promise<string | null> => {
  const res = await post({ mode: 'title', turns: turns.slice(-12) });
  if (!res.ok) return null;
  return ((await res.json()) as { title?: string | null }).title ?? null;
};
