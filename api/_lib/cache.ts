/** 메뉴 설명 캐시. 같은 메뉴명은 한 번만 LLM 에 묻는다. Redis 가 없으면 모든 호출이 조용히 건너뛴다. */
import { kv } from './kv.js';
import { dirKey, type Direction } from './direction.js';

const TTL_SECONDS = 60 * 60 * 24 * 180; // 180일
const PREFIX = 'menulens:detail:v1:';

/** 메뉴명 정규화: 전각·반각 통일, 공백 제거. 일→한은 옛 키 그대로(쌓인 캐시 유지), 다른 방향은 방향 접두 */
export const cacheKey = (d: Direction, name: string): string => `${PREFIX}${d.src === 'ja' && d.dst === 'ko' ? '' : `${dirKey(d)}:`}${name.normalize('NFKC').replace(/\s+/g, '')}`;

/** 2026-10-31 이전에 저장된 값은 pron_ko/desc_ko 키다. 읽을 때 지금 키로 바꿔 캐시를 버리지 않는다 */
const upgradeDetail = (d: Record<string, unknown>): Record<string, unknown> => {
  const { pron_ko, desc_ko, ...rest } = d;
  return { ...rest, ...(pron_ko !== undefined && rest.pron === undefined ? { pron: pron_ko } : {}), ...(desc_ko !== undefined && rest.desc === undefined ? { desc: desc_ko } : {}) };
};

export const cacheGetMany = async (d: Direction, names: readonly string[]): Promise<Map<string, Record<string, unknown>>> => {
  const out = new Map<string, Record<string, unknown>>();
  if (names.length === 0) return out;
  const c = await kv();
  if (!c) return out;
  try {
    const values = await c.mGet(names.map((n) => cacheKey(d, n)));
    values.forEach((v: string | null, i: number) => {
      if (typeof v !== 'string') return;
      try { out.set(names[i]!, upgradeDetail(JSON.parse(v) as Record<string, unknown>)); } catch { /* 깨진 값은 무시 */ }
    });
  } catch { /* 캐시 실패는 무시 */ }
  return out;
};

export const cacheSetMany = async (d: Direction, entries: ReadonlyArray<readonly [string, Record<string, unknown>]>): Promise<void> => {
  if (entries.length === 0) return;
  const c = await kv();
  if (!c) return;
  try {
    const m = c.multi();
    for (const [name, value] of entries) m.set(cacheKey(d, name), JSON.stringify(value), { EX: TTL_SECONDS });
    await m.exec();
  } catch { /* 캐시 실패는 무시 */ }
};
