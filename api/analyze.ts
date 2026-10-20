/**
 * POST /api/analyze  { image: base64, mediaType }
 *
 * 2단 파이프라인 (docs/benchmarks.md):
 *   1) Upstage OCR → 단어·좌표 (≈3초). 결과를 먼저 클라이언트에 보낸다.
 *   2) 단어 목록만 텍스트로 Sonnet 에 스트리밍 → 번역·분류·아이콘 (첫 항목 ≈1.5초).
 * OCR 이 단어를 거의 못 읽으면 이미지를 직접 보는 폴백으로 간다.
 *
 * 응답은 줄 단위 JSON (NDJSON):
 *   {"t":"ocr","width","height","words":[{id,t,box}],"rotation","tilt","ms","used"}
 *   {"t":"mode","mode":"ocr"|"image"}
 *   {"t":"text","d":"<모델 출력 조각>"}
 *   {"t":"error","m":"..."}
 *   {"t":"done"}
 */
import { codeFrom, isAllowed } from './_lib/access';
import { errorJson } from './_lib/http';
import { runOcr, type OcrResult } from './_lib/ocr';
import { IMAGE_SYSTEM_PROMPT, IMAGE_USER_PROMPT, MODEL, TEXT_SYSTEM_PROMPT } from './_lib/prompt';

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://api.timelyrouter.ai/v1/messages';
/** 이 수보다 단어가 적으면 OCR 을 믿지 않고 이미지 폴백 */
const MIN_WORDS = 3;

type Body = { image?: string; mediaType?: string };
type Line = Record<string, unknown>;

const enc = new TextEncoder();
const line = (obj: Line): Uint8Array => enc.encode(JSON.stringify(obj) + '\n');

const messagesBody = (ocr: OcrResult | null, image: string, mediaType: string): unknown => ({
  model: MODEL,
  stream: true,
  max_tokens: 6000,
  thinking: { type: 'adaptive' },
  output_config: { effort: 'low' },
  system: ocr ? TEXT_SYSTEM_PROMPT : IMAGE_SYSTEM_PROMPT,
  messages: [{
    role: 'user',
    content: ocr
      ? [{ type: 'text', text: '단어 목록:\n' + JSON.stringify(ocr.words) }]
      : [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: IMAGE_USER_PROMPT },
      ],
  }],
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
        if (e instanceof SyntaxError) continue; // 불완전한 조각
        throw e;
      }
    }
  }
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
        send({ t: 'mode', mode: ocr ? 'ocr' : 'image' });

        const upstream = await fetch(UPSTREAM, {
          method: 'POST',
          headers: { 'x-api-key': timelyKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify(messagesBody(ocr, image, mediaType)),
        });
        if (!upstream.ok || !upstream.body) {
          const detail = await upstream.text().catch(() => '');
          throw new Error(`upstream ${upstream.status}: ${detail.slice(0, 300)}`);
        }
        await readSse(upstream.body, (d) => send({ t: 'text', d }));
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
