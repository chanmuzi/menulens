/**
 * POST /api/icon { items: [{ name, tr, hint? }] } → { icons: { [name]: string[16] }, failed: string[] }
 * 키워드·모델 매칭이 안 된 메뉴의 도트 아이콘을 LLM(상위 모델)으로 생성해 Redis 에 캐시한다.
 * 한 요청에 최대 12개, 동시 4개. 실패한 이름은 failed 로 돌려주고 클라이언트는 기본 아이콘을 유지한다.
 */
import { codeFrom, isAllowed } from './_lib/access.js';
import { errorJson, json } from './_lib/http.js';
import { iconGetMany, iconSet } from './_lib/iconCache.js';
import { ICON_SYSTEM, iconUserPrompt, parseGrid } from './_lib/pixel.js';

const UPSTREAM = 'https://api.timelyrouter.ai/v1/messages';
/** 품질이 중요하므로 상위 모델. 실패하면 Sonnet 으로 한 번 더 */
const MODELS = ['claude-opus-5-5', 'claude-sonnet-5-5'] as const;
const MAX_ITEMS = 12;
const CONCURRENCY = 4;

type Item = { name: string; tr: string; hint?: string };

const generate = async (key: string, it: Item): Promise<readonly string[] | null> => {
  for (const model of MODELS) {
    try {
      const res = await fetch(UPSTREAM, {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        // 사고 토큰이 예산을 먹으므로 adaptive + effort low, 예산은 넉넉히
        body: JSON.stringify({ model, max_tokens: 3000, thinking: { type: 'adaptive' }, output_config: { effort: 'low' }, system: ICON_SYSTEM, messages: [{ role: 'user', content: iconUserPrompt(it.name, it.tr, it.hint ?? '') }] }),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n');
      const grid = parseGrid(text);
      if (grid) return grid;
    } catch { /* 다음 모델 */ }
  }
  return null;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  if (!isAllowed(codeFrom(req))) return errorJson('invalid access code', 401);
  const key = process.env.TIMELY_API_KEY;
  if (!key) return errorJson('TIMELY_API_KEY is not configured', 500);

  const body = (await req.json().catch(() => ({}))) as { items?: Item[] };
  const items = (body.items ?? []).filter((x) => typeof x?.name === 'string' && x.name.trim()).slice(0, MAX_ITEMS);
  const names = [...new Set(items.map((x) => x.name))];
  const cached = await iconGetMany(names);
  const icons: Record<string, readonly string[]> = Object.fromEntries(cached);
  const todo = items.filter((x) => !cached.has(x.name));
  const failed: string[] = [];
  // 동시 CONCURRENCY 개씩
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(todo.slice(i, i + CONCURRENCY).map(async (it) => {
      const grid = await generate(key, it);
      if (grid) { icons[it.name] = grid; await iconSet(it.name, grid); } else failed.push(it.name);
    }));
  }
  return json({ icons, failed });
};

export default { fetch: handler };
