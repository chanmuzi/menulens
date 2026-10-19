/** POST /api/auth { code } → 200 ok | 401 */
import { isAllowed } from './_lib/access';
import { errorJson, json } from './_lib/http';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return errorJson('method not allowed', 405);
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  return isAllowed(body.code ?? null) ? json({ ok: true }) : errorJson('invalid access code', 401);
}
