/**
 * 음성 인식(말소리 → 글자). Groq Whisper(무료 등급)가 기본이고, Groq 가 한도·장애면 Gemini 받아쓰기 전용 모델로 넘어간다.
 * 둘 다 안 되면 SttUnavailable 을 던진다(한도 때문이면 다시 쓸 수 있을 때까지의 초를 함께).
 */
export type Lang = 'ko' | 'ja';
export type SttResult = { readonly text: string; readonly via: 'groq' | 'gemini' };

export class SttUnavailable extends Error {
  readonly retryAfter: number | null;
  constructor(retryAfter: number | null, detail: string) { super(detail); this.retryAfter = retryAfter; }
}

const GROQ = 'https://api.groq.com/openai/v1/audio/transcriptions';
/** v3 와 정확도가 비슷하고 더 빠르고 싸다(2026-10-23 측정, benchmarks) */
const GROQ_MODEL = 'whisper-large-v3-turbo';
const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_MODEL = 'gemini-3.5-transcribe';

const EXT: Record<string, string> = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3' };

/** 「42s」「11m31.2s」「1h2m」 같은 Groq 리셋 표기 → 초. 숫자만 오면(retry-after) 그대로 */
export const parseWait = (v: string | null): number | null => {
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v.trim())) return Math.ceil(Number(v));
  const m = /^(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?$/.exec(v.trim());
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return Math.ceil(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0));
};

/** 다시 시도해도 같은 결과일 오류(형식 오류 등)는 넘기지 않고 바로 던진다 */
export class SttBadInput extends Error {}

const groq = async (audio: Uint8Array<ArrayBuffer>, type: string, lang: Lang, signal: AbortSignal): Promise<string> => {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new SttUnavailable(null, 'GROQ_API_KEY missing');
  const fd = new FormData();
  fd.append('file', new Blob([audio], { type }), `talk.${EXT[type] ?? 'm4a'}`);
  fd.append('model', GROQ_MODEL);
  fd.append('language', lang);
  fd.append('temperature', '0');
  fd.append('response_format', 'json');
  const res = await fetch(GROQ, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: fd, signal });
  if (res.ok) return ((await res.json()) as { text?: string }).text?.trim() ?? '';
  const body = await res.text().catch(() => '');
  if (res.status === 429) {
    const wait = parseWait(res.headers.get('retry-after')) ?? parseWait(res.headers.get('x-ratelimit-reset-audio-seconds')) ?? parseWait(res.headers.get('x-ratelimit-reset-requests'));
    throw new SttUnavailable(wait, `groq 429: ${body.slice(0, 200)}`);
  }
  if (res.status >= 500) throw new SttUnavailable(null, `groq ${res.status}: ${body.slice(0, 200)}`);
  // 400(파일 형식 등)은 Gemini 로 넘겨도 같을 가능성이 크지만, 키·권한 문제(401·403)는 Gemini 로 살릴 수 있다
  if (res.status === 401 || res.status === 403) throw new SttUnavailable(null, `groq ${res.status}: ${body.slice(0, 200)}`);
  throw new SttBadInput(`groq ${res.status}: ${body.slice(0, 200)}`);
};

/** Interactions API 응답에서 글자를 모은다. SDK 의 output_text 가 있으면 그것, 없으면 outputs 안의 text 들 */
const geminiText = (j: unknown): string => {
  const o = j as { output_text?: unknown; outputs?: unknown };
  if (typeof o.output_text === 'string') return o.output_text;
  const texts: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') {
      const r = v as Record<string, unknown>;
      if (typeof r.text === 'string') texts.push(r.text);
      Object.entries(r).forEach(([k, x]) => { if (k !== 'text') walk(x); });
    }
  };
  walk(o.outputs);
  return texts.join('');
};

const gemini = async (audio: Uint8Array<ArrayBuffer>, type: string, lang: Lang, signal: AbortSignal): Promise<string> => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new SttUnavailable(null, 'GEMINI_API_KEY missing');
  const res = await fetch(GEMINI, {
    method: 'POST', signal,
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: [{ type: 'audio', data: Buffer.from(audio).toString('base64'), mime_type: type }],
      generation_config: { transcription_config: { language_codes: [lang === 'ko' ? 'ko-KR' : 'ja-JP'] } },
    }),
  });
  const body = await res.text().catch(() => '');
  if (res.ok) return geminiText(JSON.parse(body)).trim();
  // 무료 등급 한도 초과 문구: 「Please retry in 54s」
  const wait = res.status === 429 ? parseWait(/retry in ([\d.]+s)/i.exec(body)?.[1] ?? null) : null;
  throw new SttUnavailable(wait, `gemini ${res.status}: ${body.slice(0, 200)}`);
};

/** Groq → Gemini. 둘 다 안 되면 SttUnavailable. 어느 한쪽이라도 한도라서 대기 시간을 알면 그중 짧은 것(그때 다시 된다), 모르면 null */
export const transcribe = async (audio: Uint8Array<ArrayBuffer>, type: string, lang: Lang, signal: AbortSignal): Promise<SttResult> => {
  let first: SttUnavailable;
  try {
    return { text: await groq(audio, type, lang, signal), via: 'groq' };
  } catch (e) {
    if (!(e instanceof SttUnavailable) || signal.aborted) throw e;
    first = e;
  }
  try {
    return { text: await gemini(audio, type, lang, signal), via: 'gemini' };
  } catch (e) {
    if (!(e instanceof SttUnavailable) || signal.aborted) throw e;
    const waits = [first.retryAfter, e.retryAfter].filter((w): w is number => w !== null);
    throw new SttUnavailable(waits.length > 0 ? Math.min(...waits) : null, `${first.message} / ${e.message}`);
  }
};
