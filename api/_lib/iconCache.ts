/** 생성된 도트 아이콘 캐시. 같은 메뉴명은 한 번만 만든다. 키는 설명 캐시와 같은 정규화 */
import { kv } from './kv.js';

const PREFIX = 'menulens:icon:v1:';
const TTL_SECONDS = 60 * 60 * 24 * 365;
const key = (nameJa: string): string => PREFIX + nameJa.normalize('NFKC').replace(/\s+/g, '');

export const iconGetMany = async (names: readonly string[]): Promise<Map<string, readonly string[]>> => {
  const out = new Map<string, readonly string[]>();
  if (names.length === 0) return out;
  const c = await kv();
  if (!c) return out;
  try {
    const values = await c.mGet(names.map(key));
    values.forEach((v: string | null, i: number) => {
      if (typeof v !== 'string') return;
      try { const g = JSON.parse(v) as string[]; if (Array.isArray(g) && g.length === 16) out.set(names[i]!, g); } catch { /* 무시 */ }
    });
  } catch { /* 캐시 실패는 무시 */ }
  return out;
};

export const iconSet = async (nameJa: string, grid: readonly string[]): Promise<void> => {
  const c = await kv();
  if (!c) return;
  try { await c.set(key(nameJa), JSON.stringify(grid), { EX: TTL_SECONDS }); } catch { /* 무시 */ }
};
