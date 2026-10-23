/**
 * Claude 호출 공용 부품. `readSse` 는 모든 엔드포인트가 쓴다.
 * `callClaude` 는 대화 통역(/api/talk) 전용: Timely 라우터가 기본이고, 한도(quota·rate limit) 응답이면 Anthropic 직접 키로 같은 요청을 한 번 더 보낸다.
 * 직접 키(ANTHROPIC_API_KEY)는 Max 구독의 월 API 크레딧에서 차감되므로, 다른 엔드포인트(analyze·chat·icon)에 붙이려면 비용 결정이 필요하다(AGENTS.md 절대 규칙 3).
 * 한도 외의 오류(400 형식 오류, 5xx)는 그대로 돌려준다.
 */
const TIMELY = 'https://api.timelyrouter.ai/v1/messages';
const ANTHROPIC = 'https://api.anthropic.com/v1/messages';

const QUOTA_STATUS = new Set([402, 429]);
/** 「max_tokens exceeded」「insufficient permissions」 같은 형식·권한 오류는 잡지 않는다(유료 직접 키로 헛된 재시도) */
const QUOTA_TEXT = /quota|credit balance|insufficient[_ ](?:quota|credit|funds)|billing|rate[ _-]?limit/i;

/** 402·429 이거나, 400·403 인데 본문이 한도·크레딧 이야기면 한도 문제로 본다 */
export const isQuotaError = (status: number, body: string): boolean =>
  QUOTA_STATUS.has(status) || ((status === 400 || status === 403) && QUOTA_TEXT.test(body));

export type ClaudeCall = { readonly res: Response; readonly via: 'timely' | 'anthropic' };

export const callClaude = async (body: unknown, signal?: AbortSignal): Promise<ClaudeCall> => {
  const timelyKey = process.env.TIMELY_API_KEY;
  const directKey = process.env.ANTHROPIC_API_KEY;
  const send = (url: string, key: string) => fetch(url, {
    signal, method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (timelyKey) {
    const res = await send(TIMELY, timelyKey);
    if (res.ok || !directKey) return { res, via: 'timely' };
    // 본문을 읽어 한도 문제인지 본다. 아니면 읽은 본문으로 응답을 다시 만들어 돌려준다
    const text = await res.text().catch(() => '');
    if (!isQuotaError(res.status, text)) return { res: new Response(text, { status: res.status }), via: 'timely' };
  }
  if (!directKey) throw new Error('TIMELY_API_KEY is not configured');
  return { res: await send(ANTHROPIC, directKey), via: 'anthropic' };
};

/** Anthropic SSE 에서 text_delta 만 뽑는다 */
export const readSse = async (body: ReadableStream<Uint8Array>, onText: (t: string) => void): Promise<void> => {
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
      } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
    }
  }
};
