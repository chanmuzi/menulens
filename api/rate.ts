/**
 * GET /api/rate → { krwPerJpy, date }
 * open.er-api.com 무료 환율(키 불필요). 엣지 캐시 12시간.
 */
import { errorJson, json } from './_lib/http.js';

const SOURCE = 'https://open.er-api.com/v6/latest/JPY';

const handler = async (): Promise<Response> => {
  const res = await fetch(SOURCE, { headers: { accept: 'application/json' } });
  if (!res.ok) return errorJson(`rate source ${res.status}`, 502);
  const data = (await res.json()) as { rates?: { KRW?: number }; time_last_update_utc?: string };
  const krw = data.rates?.KRW;
  if (typeof krw !== 'number') return errorJson('KRW rate missing', 502);
  return json(
    { krwPerJpy: krw, date: data.time_last_update_utc ?? null },
    200,
    { 'cache-control': 'public, s-maxage=43200, stale-while-revalidate=86400' },
  );
};

export default { fetch: handler };
