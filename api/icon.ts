/**
 * POST /api/icon { items: [{ name, tr, hint? }] } → { icons: { [name]: string[16] }, failed: string[] }
 * 키워드·모델 매칭이 안 된 메뉴의 도트 아이콘을 LLM(제공자의 상위 모델, 없으면 기본 모델)으로 생성해 Redis 에 캐시한다.
 * 한 요청에 최대 12개, 동시 4개. 실패한 이름은 failed 로 돌려주고 클라이언트는 기본 아이콘을 유지한다.
 */
import { codeFrom, isAllowed } from './_lib/access.js';
import { errorJson, json } from './_lib/http.js';
import { iconGetMany, iconSet } from './_lib/iconCache.js';
import { ICON_SYSTEM, iconUserPrompt, parseGrid } from './_lib/pixel.js';
import { llmText, resolveProvider, type Provider } from './_lib/llm.js';

/** 품질이 중요하므로 상위 모델(iconModel) 먼저. 실패하면 기본 모델로 한 번 더. 상위 모델이 없는 제공자는 기본 모델 한 번 */
const models = (p: Provider): readonly string[] => [...new Set([p.iconModel ?? p.model, p.model])];
const MAX_ITEMS = 12;
const CONCURRENCY = 4;

type Item = { name: string; tr: string; hint?: string };

const generate = async (p: Provider, it: Item): Promise<readonly string[] | null> => {
  for (const model of models(p)) {
    try {
      // 사고 토큰이 예산을 먹으므로 짧게 생각(think 기본), 예산은 넉넉히
      const { text } = await llmText({ model, maxTokens: 3000, system: ICON_SYSTEM, messages: [{ role: 'user', content: iconUserPrompt(it.name, it.tr, it.hint ?? '') }] });
      const grid = parseGrid(text);
      if (grid) return grid;
    } catch { /* 다음 모델 */ }
  }
  return null;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  if (!isAllowed(codeFrom(req))) return errorJson('invalid access code', 401);
  let provider: Provider;
  try { provider = resolveProvider(); } catch (e) { return errorJson(e instanceof Error ? e.message : String(e), 500); }

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
      const grid = await generate(provider, it);
      if (grid) { icons[it.name] = grid; await iconSet(it.name, grid); } else failed.push(it.name);
    }));
  }
  return json({ icons, failed });
};

export default { fetch: handler };
