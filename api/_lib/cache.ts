/**
 * 메뉴 설명 캐시. 같은 메뉴명은 한 번만 LLM 에 묻는다.
 * Upstash Redis REST (Vercel Marketplace 에서 무료로 추가하면 UPSTASH_REDIS_REST_URL / _TOKEN 이 자동 등록된다).
 * 환경변수가 없으면 모든 호출이 조용히 건너뛴다.
 */
const TTL_SECONDS = 60 * 60 * 24 * 180; // 180일
const PREFIX = 'menulens:detail:v1:';

const conf = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
};

/** 메뉴명 정규화: 전각·반각 통일, 공백 제거 */
export const cacheKey = (nameJa: string): string => PREFIX + nameJa.normalize('NFKC').replace(/\s+/g, '');

const call = async (commands: unknown[][]): Promise<unknown[] | null> => {
  const c = conf();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}/pipeline`, { method: 'POST', headers: { authorization: `Bearer ${c.token}`, 'content-type': 'application/json' }, body: JSON.stringify(commands) });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result?: unknown }>;
    return data.map((d) => d.result ?? null);
  } catch { return null; }
};

export const cacheGetMany = async (names: readonly string[]): Promise<Map<string, Record<string, unknown>>> => {
  const out = new Map<string, Record<string, unknown>>();
  if (names.length === 0) return out;
  const res = await call([['MGET', ...names.map(cacheKey)]]);
  const values = Array.isArray(res?.[0]) ? (res![0] as Array<string | null>) : [];
  values.forEach((v, i) => {
    if (typeof v !== 'string') return;
    try { out.set(names[i]!, JSON.parse(v) as Record<string, unknown>); } catch { /* 깨진 값은 무시 */ }
  });
  return out;
};

export const cacheSetMany = async (entries: ReadonlyArray<readonly [string, Record<string, unknown>]>): Promise<void> => {
  if (entries.length === 0) return;
  await call(entries.map(([name, value]) => ['SET', cacheKey(name), JSON.stringify(value), 'EX', TTL_SECONDS]));
};
