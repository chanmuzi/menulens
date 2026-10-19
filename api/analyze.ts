/**
 * POST /api/analyze  { image: base64, mediaType }
 * Timely Router(Anthropic Messages 호환)에 스트리밍으로 보내고,
 * 텍스트 델타만 평문 스트림으로 클라이언트에 흘려 보낸다.
 */
import { codeFrom, isAllowed } from './_lib/access';
import { errorJson } from './_lib/http';
import { MODEL, SYSTEM_PROMPT, USER_PROMPT } from './_lib/prompt';

export const config = { runtime: 'edge' };

const UPSTREAM = 'https://api.timelyrouter.ai/v1/messages';

type Body = { image?: string; mediaType?: string };

/** Anthropic SSE 스트림에서 text_delta 만 뽑아내는 변환기 */
const sseToText = (): TransformStream<Uint8Array, Uint8Array> => {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let pending = '';
  return new TransformStream({
    transform(chunk, controller) {
      pending += dec.decode(chunk, { stream: true });
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw) as { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
            controller.enqueue(enc.encode(ev.delta.text));
          } else if (ev.type === 'error') {
            controller.enqueue(enc.encode(`\n\u0000ERROR:${ev.error?.message ?? 'upstream error'}`));
          }
        } catch { /* 불완전한 JSON 조각은 무시 */ }
      }
    },
  });
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  if (!isAllowed(codeFrom(req))) return errorJson('invalid access code', 401);

  const key = process.env.TIMELY_API_KEY;
  if (!key) return errorJson('TIMELY_API_KEY is not configured', 500);

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.image) return errorJson('image is required', 400);
  const mediaType = body.mediaType ?? 'image/jpeg';

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: body.image } },
          { type: 'text', text: USER_PROMPT },
        ],
      }],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return errorJson(`upstream ${upstream.status}: ${detail.slice(0, 300)}`, 502);
  }

  return new Response(upstream.body.pipeThrough(sseToText()), {
    status: 200,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}
