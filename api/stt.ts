/**
 * POST /api/stt — 본문은 녹음 파일 그대로(content-type audio/*), 헤더 x-lang: ko|ja
 * → 200 { text, via: 'groq'|'gemini', ms } | 503 { error: 'stt_unavailable', retryAfter: 초|null } | 400 | 401 | 413
 * 대화 통역의 「말하기」. 번역은 클라이언트가 이어서 /api/talk 로 따로 부른다(글자가 먼저 보이게).
 */
import { codeFrom, isAllowed } from './_lib/access.js';
import { errorJson, json } from './_lib/http.js';
import { SttBadInput, SttUnavailable, transcribe, type Lang } from './_lib/stt.js';

/** 60초 녹음(AAC 64kbps ≈ 0.5MB)의 여유 있는 상한. Vercel 본문 상한(4.5MB) 안 */
const MAX_BYTES = 3_000_000;
const TYPES = /^audio\/(mp4|x-m4a|aac|webm|ogg|wav|mpeg)$/;

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  if (!isAllowed(codeFrom(req))) return errorJson('invalid access code', 401);
  const type = (req.headers.get('content-type') ?? '').split(';')[0]!.trim();
  if (!TYPES.test(type)) return errorJson(`unsupported audio type: ${type}`, 400);
  const lang: Lang = req.headers.get('x-lang') === 'ja' ? 'ja' : 'ko';
  const audio = new Uint8Array(await req.arrayBuffer());
  if (audio.byteLength === 0) return errorJson('empty audio', 400);
  if (audio.byteLength > MAX_BYTES) return errorJson('audio too large', 413);
  const t0 = Date.now();
  try {
    const r = await transcribe(audio, type, lang, req.signal);
    return json({ text: r.text, via: r.via, ms: Date.now() - t0 });
  } catch (e) {
    if (e instanceof SttUnavailable) {
      console.error('[stt] unavailable', e.message);
      return json({ error: 'stt_unavailable', retryAfter: e.retryAfter }, 503);
    }
    if (e instanceof SttBadInput) { console.error('[stt] bad input', e.message); return errorJson('audio could not be transcribed', 400); }
    return errorJson(e instanceof Error ? e.message : String(e), 500);
  }
};

export default { fetch: handler };
