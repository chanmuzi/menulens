/**
 * LLM 제공자 추상화. 모든 엔드포인트(analyze·chat·icon·talk)는 이 모듈로만 모델을 부른다.
 *
 * 제공자는 환경변수로 고른다(`LLM_PROVIDER`). 비어 있으면 키가 있는 순서대로 timely → anthropic → openai → upstage.
 *   timely     Timely Router(Anthropic 호환). TIMELY_API_KEY
 *   anthropic  Anthropic 직접.               ANTHROPIC_API_KEY
 *   openrouter OpenRouter 의 Anthropic 호환 경로. OPENROUTER_API_KEY, LLM_MODEL 필수(미검증)
 *   openai     OpenAI Chat Completions.      OPENAI_API_KEY
 *   upstage    Upstage Solar(OpenAI 호환, 글자만 — 이미지 입력 불가). UPSTAGE_API_KEY(OCR 과 같은 키)
 * 덮어쓰기: LLM_API_KEY · LLM_MODEL · LLM_ICON_MODEL(아이콘 생성용 상위 모델) · LLM_BASE_URL.
 *
 * 요청은 한 가지 형태(`LlmRequest`)로 쓰고, 제공자 형식(Anthropic Messages / OpenAI Chat Completions)으로 여기서 바꾼다.
 * 응답도 글자만 돌려준다: 스트리밍은 `llmStream`(글자 조각 콜백), 한 번에 받기는 `llmText`.
 * 사고(thinking)는 `think` 로 고른다: 'low' 는 짧게 생각(Anthropic adaptive + effort low / OpenAI reasoning_effort low), 'off' 는 생각 없이.
 *
 * 대화 통역의 예비 경로: 기본 제공자가 timely 이고 ANTHROPIC_API_KEY 가 있으면, 한도(402·429·한도 문구) 응답일 때만
 * 같은 요청을 Anthropic 직접으로 한 번 더 보낸다(`fallback: true` 를 준 호출만). 다른 엔드포인트에 붙이려면 비용 결정이 필요하다(AGENTS.md 절대 규칙 3).
 */
export type LlmFormat = 'anthropic' | 'openai';
export type ProviderId = 'timely' | 'anthropic' | 'openrouter' | 'openai' | 'upstage';

export type LlmPart = { readonly type: 'text'; readonly text: string } | { readonly type: 'image'; readonly mediaType: string; readonly data: string };
export type LlmMessage = { readonly role: 'user' | 'assistant'; readonly content: string | readonly LlmPart[] };
export type LlmRequest = {
  readonly system: string;
  readonly messages: readonly LlmMessage[];
  readonly maxTokens: number;
  /** 'low': 짧게 생각(기본) · 'off': 생각 없이(짧은 구조화 출력) */
  readonly think?: 'low' | 'off';
  /** 제공자 기본 모델 대신 쓸 모델(아이콘 생성의 상위 모델 등) */
  readonly model?: string;
};
export type LlmOptions = { readonly signal?: AbortSignal; readonly fallback?: boolean };

export type Provider = {
  readonly id: ProviderId;
  readonly format: LlmFormat;
  readonly url: string;
  readonly auth: 'x-api-key' | 'bearer';
  readonly key: string;
  readonly model: string;
  /** 아이콘 생성처럼 품질이 중요한 곳에 쓰는 상위 모델. 없으면 기본 모델 */
  readonly iconModel: string | null;
  /** 이미지 입력을 받는지. 아니면 OCR 폴백·사진 챗을 끈다 */
  readonly vision: boolean;
  /** OpenAI 형식에서 think 'low' 일 때의 reasoning_effort 값(없으면 보내지 않는다 → 제공자 기본, Solar 는 꺼짐) */
  readonly reasoningLow: string | null;
  /** OpenAI 형식에서 think 'off' 일 때의 값. 빼면 제공자 기본(OpenAI 는 medium)이 되어 오히려 느려지므로 끄는 값을 따로 둔다(gpt-5.4-mini·solar-pro4 모두 'none' 실측 확인) */
  readonly reasoningOff: string | null;
};

type Preset = Omit<Provider, 'key'> & { readonly keyEnv: string };

const PRESETS: Readonly<Record<ProviderId, Preset>> = {
  timely: { id: 'timely', format: 'anthropic', url: 'https://api.timelyrouter.ai/v1/messages', auth: 'x-api-key', keyEnv: 'TIMELY_API_KEY', model: 'claude-sonnet-5-5', iconModel: 'claude-opus-5-5', vision: true, reasoningLow: null, reasoningOff: null },
  anthropic: { id: 'anthropic', format: 'anthropic', url: 'https://api.anthropic.com/v1/messages', auth: 'x-api-key', keyEnv: 'ANTHROPIC_API_KEY', model: 'claude-sonnet-5-5', iconModel: 'claude-opus-5-5', vision: true, reasoningLow: null, reasoningOff: null },
  openrouter: { id: 'openrouter', format: 'anthropic', url: 'https://openrouter.ai/api/v1/messages', auth: 'bearer', keyEnv: 'OPENROUTER_API_KEY', model: '', iconModel: null, vision: true, reasoningLow: null, reasoningOff: null },
  openai: { id: 'openai', format: 'openai', url: 'https://api.openai.com/v1/chat/completions', auth: 'bearer', keyEnv: 'OPENAI_API_KEY', model: 'gpt-5.4-mini', iconModel: null, vision: true, reasoningLow: 'low', reasoningOff: 'none' },
  upstage: { id: 'upstage', format: 'openai', url: 'https://api.upstage.ai/v1/chat/completions', auth: 'bearer', keyEnv: 'UPSTAGE_API_KEY', model: 'solar-pro4', iconModel: null, vision: false, reasoningLow: null, reasoningOff: null },
};
const AUTO_ORDER: readonly ProviderId[] = ['timely', 'anthropic', 'openai', 'upstage'];

const isProviderId = (v: string | undefined): v is ProviderId => v !== undefined && v in PRESETS;

const build = (p: Preset, key: string): Provider => {
  const env = process.env;
  const model = env.LLM_MODEL || p.model;
  if (!model) throw new Error(`LLM_MODEL is required for provider ${p.id}`);
  return { ...p, key, model, iconModel: env.LLM_ICON_MODEL || p.iconModel, url: env.LLM_BASE_URL || p.url };
};

/** 환경변수로 제공자를 정한다. 키가 하나도 없으면 던진다(핸들러가 500 으로 바꾼다) */
export const resolveProvider = (): Provider => {
  const env = process.env;
  const chosen = env.LLM_PROVIDER?.trim().toLowerCase();
  if (chosen) {
    if (!isProviderId(chosen)) throw new Error(`unknown LLM_PROVIDER: ${chosen}`);
    const p = PRESETS[chosen];
    const key = env.LLM_API_KEY || env[p.keyEnv];
    if (!key) throw new Error(`${p.keyEnv} (or LLM_API_KEY) is not configured`);
    return build(p, key);
  }
  for (const id of AUTO_ORDER) {
    const p = PRESETS[id];
    const key = env[p.keyEnv];
    if (key) return build(p, env.LLM_API_KEY || key);
  }
  throw new Error('no LLM provider is configured (set TIMELY_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY or UPSTAGE_API_KEY)');
};

/** 대화 통역용 예비 경로: 기본이 timely 이고 Anthropic 키가 있을 때만 */
const fallbackProvider = (primary: Provider): Provider | null => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (primary.id !== 'timely' || !key) return null;
  return { ...PRESETS.anthropic, key, model: primary.model, iconModel: primary.iconModel, url: PRESETS.anthropic.url };
};

const QUOTA_STATUS = new Set([402, 429]);
/** 「max_tokens exceeded」「insufficient permissions」 같은 형식·권한 오류는 잡지 않는다(유료 직접 키로 헛된 재시도) */
const QUOTA_TEXT = /quota|credit balance|insufficient[_ ](?:quota|credit|funds)|billing|rate[ _-]?limit/i;
/** 402·429 이거나, 400·403 인데 본문이 한도·크레딧 이야기면 한도 문제로 본다 */
export const isQuotaError = (status: number, body: string): boolean =>
  QUOTA_STATUS.has(status) || ((status === 400 || status === 403) && QUOTA_TEXT.test(body));

export class UpstreamError extends Error {
  constructor(readonly status: number, readonly via: ProviderId) { super(`upstream ${status}`); }
}

// ── 요청 본문 ────────────────────────────────────────────────────────────────

const anthropicContent = (c: LlmMessage['content']): unknown =>
  typeof c === 'string' ? c : c.map((p) => (p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image', source: { type: 'base64', media_type: p.mediaType, data: p.data } }));

const openaiContent = (c: LlmMessage['content']): unknown =>
  typeof c === 'string' ? c : c.map((p) => (p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image_url', image_url: { url: `data:${p.mediaType};base64,${p.data}` } }));

const body = (p: Provider, r: LlmRequest, stream: boolean): unknown => {
  const model = r.model ?? p.model;
  if (p.format === 'anthropic') {
    // Claude Sonnet 5.5: 생각을 끄려면 between_tools, 켜면 adaptive + effort(짧게)
    const think = r.think === 'off' ? { thinking: { type: 'between_tools' } } : { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } };
    return { model, max_tokens: r.maxTokens, stream, system: r.system, ...think, messages: r.messages.map((m) => ({ role: m.role, content: anthropicContent(m.content) })) };
  }
  const effort = r.think === 'off' ? p.reasoningOff : p.reasoningLow;
  return {
    model, max_completion_tokens: r.maxTokens, stream,
    ...(effort ? { reasoning_effort: effort } : {}),
    messages: [{ role: 'system', content: r.system }, ...r.messages.map((m) => ({ role: m.role, content: openaiContent(m.content) }))],
  };
};

const headers = (p: Provider): Record<string, string> => ({
  'content-type': 'application/json',
  ...(p.auth === 'x-api-key' ? { 'x-api-key': p.key, 'anthropic-version': '2023-06-01' } : { authorization: `Bearer ${p.key}` }),
});

const send = (p: Provider, r: LlmRequest, stream: boolean, signal?: AbortSignal): Promise<Response> =>
  fetch(p.url, { signal, method: 'POST', headers: headers(p), body: JSON.stringify(body(p, r, stream)) });

type Call = { readonly res: Response; readonly via: ProviderId; readonly format: LlmFormat };

/** 제공자에 보내고, 실패면 상태만 담은 UpstreamError 를 던진다(본문은 서버 로그에만). fallback 이면 한도 응답에 한해 예비 경로로 한 번 더 */
const call = async (r: LlmRequest, stream: boolean, o: LlmOptions): Promise<Call> => {
  const primary = resolveProvider();
  const res = await send(primary, r, stream, o.signal);
  if (res.ok) return { res, via: primary.id, format: primary.format };
  const text = (await res.text().catch(() => '')).slice(0, 300);
  console.error('[llm]', primary.id, res.status, text);
  const fb = o.fallback ? fallbackProvider(primary) : null;
  if (!fb || !isQuotaError(res.status, text)) throw new UpstreamError(res.status, primary.id);
  const res2 = await send(fb, r, stream, o.signal);
  if (!res2.ok) { console.error('[llm]', fb.id, res2.status, (await res2.text().catch(() => '')).slice(0, 300)); throw new UpstreamError(res2.status, fb.id); }
  return { res: res2, via: fb.id, format: fb.format };
};

// ── 응답 읽기 ────────────────────────────────────────────────────────────────

type AnthropicEvent = { type?: string; delta?: { type?: string; text?: string }; error?: { message?: string } };
type OpenAiChunk = { choices?: Array<{ delta?: { content?: string | null } }>; error?: { message?: string } };

/** SSE 본문에서 글자 조각만 뽑아 콜백으로 넘긴다(Anthropic text_delta / OpenAI choices[0].delta.content) */
export const readStream = async (body: ReadableStream<Uint8Array>, format: LlmFormat, onText: (t: string) => void): Promise<void> => {
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
        if (format === 'anthropic') {
          const ev = JSON.parse(raw) as AnthropicEvent;
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) onText(ev.delta.text);
          else if (ev.type === 'error') throw new Error(ev.error?.message ?? 'upstream error');
        } else {
          const ev = JSON.parse(raw) as OpenAiChunk;
          if (ev.error) throw new Error(ev.error.message ?? 'upstream error');
          const t = ev.choices?.[0]?.delta?.content;
          if (t) onText(t);
        }
      } catch (e) { if (!(e instanceof SyntaxError)) throw e; }
    }
  }
};

type AnthropicMessage = { content?: Array<{ type: string; text?: string }>; stop_reason?: string };
type OpenAiCompletion = { choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }> };

const textOf = (data: unknown, format: LlmFormat): { text: string; truncated: boolean } => {
  if (format === 'anthropic') {
    const d = data as AnthropicMessage;
    return { text: (d.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join(''), truncated: d.stop_reason === 'max_tokens' };
  }
  const d = data as OpenAiCompletion;
  return { text: d.choices?.[0]?.message?.content ?? '', truncated: d.choices?.[0]?.finish_reason === 'length' };
};

export type LlmResult = { readonly text: string; readonly via: ProviderId; readonly truncated: boolean };

/** 한 번에 받기 */
export const llmText = async (r: LlmRequest, o: LlmOptions = {}): Promise<LlmResult> => {
  const c = await call(r, false, o);
  return { ...textOf(await c.res.json(), c.format), via: c.via };
};

/** 스트리밍: 글자 조각마다 onText. 끝나면 어느 경로로 받았는지 돌려준다 */
export const llmStream = async (r: LlmRequest, onText: (t: string) => void, o: LlmOptions = {}): Promise<{ readonly via: ProviderId }> => {
  const c = await call(r, true, o);
  if (!c.res.body) throw new UpstreamError(c.res.status, c.via);
  await readStream(c.res.body, c.format, onText);
  return { via: c.via };
};

/** 지금 제공자가 이미지 입력을 받는지(분석 이미지 폴백·사진 챗 가능 여부). 미설정이면 false */
export const llmVision = (): boolean => { try { return resolveProvider().vision; } catch { return false; } };
