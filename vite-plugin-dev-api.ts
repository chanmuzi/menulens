/**
 * 로컬 개발용: /api/* 요청을 api/<name>.ts 의 Web-표준 핸들러(Request → Response)로 연결한다.
 * Vercel Edge Function 과 같은 시그니처를 쓰므로 배포 시에는 이 플러그인이 필요 없다.
 */
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv } from 'vite';
import { existsSync } from 'node:fs';
import path from 'node:path';

type Handler = (req: Request) => Promise<Response> | Response;
type Module = { default: Handler | { fetch: Handler } };

const readBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

/** 클라이언트가 끊으면 Vercel(supportsCancellation)처럼 req.signal 을 중단시킨다. 응답을 다 쓴 뒤의 close 는 중단이 아니다 */
const toRequest = async (req: IncomingMessage, res: ServerResponse): Promise<Request> => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(', '));
  }
  const method = req.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : new Uint8Array(await readBody(req));
  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });
  return new Request(url, { method, headers, body, signal: ac.signal });
};

const writeResponse = async (res: ServerResponse, out: Response): Promise<void> => {
  const headers: Record<string, string> = {};
  out.headers.forEach((v, k) => { headers[k] = v; });
  res.writeHead(out.status, headers);
  if (!out.body) { res.end(); return; }
  const reader = out.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (res.destroyed) { await reader.cancel().catch(() => undefined); return; }
    res.write(value);
    (res as ServerResponse & { flush?: () => void }).flush?.();
  }
  res.end();
};

export const devApi = (): Plugin => ({
  name: 'menulens-dev-api',
  config(_, { mode }) {
    const env = loadEnv(mode, process.cwd(), '');
    for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
  },
  configureServer(server: ViteDevServer) {
    server.middlewares.use(async (req, res, next) => {
      const m = /^\/api\/([a-z0-9_-]+)(?:\?|$)/i.exec(req.url ?? '');
      if (!m) return next();
      const file = path.resolve(process.cwd(), 'api', `${m[1]}.ts`);
      if (!existsSync(file)) { res.statusCode = 404; res.end('not found'); return; }
      try {
        const mod = (await server.ssrLoadModule(file)) as Module;
        const fn = typeof mod.default === 'function' ? mod.default : mod.default.fetch;
        const out = await fn(await toRequest(req, res));
        await writeResponse(res, out);
      } catch (e) {
        server.config.logger.error(String(e));
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
  },
});
