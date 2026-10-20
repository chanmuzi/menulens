/**
 * GET /api/photo?q=<검색어> → { url, pageUrl, credit } | { url: null }
 * Wikimedia Commons 검색(무료, 키 불필요). 엣지 캐시 7일.
 */
import { errorJson, json } from './_lib/http.js';

const UA = 'MenuLens/0.1 (menu translation hobby app)';

type Page = {
  title: string;
  imageinfo?: Array<{
    thumburl?: string;
    descriptionurl?: string;
    extmetadata?: { Artist?: { value?: string }; LicenseShortName?: { value?: string } };
  }>;
};

const search = async (q: string): Promise<Page[]> => {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query', generator: 'search', gsrsearch: `filetype:bitmap ${q}`, gsrnamespace: '6', gsrlimit: '5',
    prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '480', format: 'json',
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
  if (!res.ok) throw new Error(`commons ${res.status}`);
  const data = (await res.json()) as { query?: { pages?: Record<string, Page> } };
  return Object.values(data.query?.pages ?? {}).sort((a, b) => ((a as { index?: number }).index ?? 0) - ((b as { index?: number }).index ?? 0));
};

const stripHtml = (s: string): string => s.replace(/<[^>]+>/g, '').trim();

const handler = async (req: Request): Promise<Response> => {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q) return errorJson('q is required', 400);
  const cache = { 'cache-control': 'public, s-maxage=604800, stale-while-revalidate=2592000' };
  try {
    const pages = await search(q);
    const hit = pages.find((p) => p.imageinfo?.[0]?.thumburl && /\.(jpe?g|png|webp)$/i.test(p.title));
    const info = hit?.imageinfo?.[0];
    if (!hit || !info?.thumburl) return json({ url: null }, 200, cache);
    const artist = stripHtml(info.extmetadata?.Artist?.value ?? '');
    const license = info.extmetadata?.LicenseShortName?.value ?? '';
    return json({
      url: info.thumburl,
      pageUrl: info.descriptionurl ?? null,
      credit: [artist, license].filter(Boolean).join(' · ') || 'Wikimedia Commons',
    }, 200, cache);
  } catch (e) {
    return errorJson(String(e), 502);
  }
};

export default { fetch: handler };
