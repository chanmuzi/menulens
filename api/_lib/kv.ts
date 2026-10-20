/**
 * Redis 연결 (REDIS_URL, TCP). Vercel Marketplace 의 Redis Cloud / Upstash 모두 이 형식의 URL 을 준다.
 * Node.js 런타임 전용. 환경변수가 없거나 접속이 실패하면 null 을 돌려주고 호출부는 조용히 건너뛴다.
 */
import { createClient, type RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

export const kv = async (): Promise<RedisClientType | null> => {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (client?.isOpen) return client;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const c = createClient({ url, socket: { connectTimeout: 3000, reconnectStrategy: false } }) as RedisClientType;
      c.on('error', () => { /* 연결 오류는 호출부에서 null 로 처리 */ });
      await c.connect();
      client = c;
      return c;
    } catch {
      client = null;
      return null;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
};
