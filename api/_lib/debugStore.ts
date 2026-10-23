/**
 * 진단용 스캔 보관 (선택). DEBUG_STORE=1 이고 Redis 가 연결돼 있을 때만 최근 스캔을 7일간 저장한다.
 * 용도: 사용자가 겪은 실제 케이스(사진·OCR·1단계 결과)를 개발자가 나중에 재현·확인하기 위함.
 * 조회: REDIS_URL=... python3 scripts/bench/debug_pull.py <폴더>
 */
import { kv } from './kv.js';

const TTL_SECONDS = 60 * 60 * 24 * 7;
const LIST_KEY = 'menulens:debug:list';
const MAX_KEEP = 20;
const MAX_IMAGE_CHARS = 900_000; // base64 기준 ≈ 650KB

export type DebugRecord = {
  readonly at: string;
  readonly mode: 'ocr' | 'image';
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly tilt: number;
  readonly words: readonly unknown[];
  readonly items: readonly unknown[];
  readonly notes: readonly unknown[];
  readonly chunks: number;
  readonly image?: string;
};

const recordKey = (id: string): string => `menulens:debug:${id}`;

/** 가장 오래된 기록 하나를 목록과 본문에서 함께 지운다. 지울 것이 없으면 false */
const dropOldest = async (c: NonNullable<Awaited<ReturnType<typeof kv>>>): Promise<boolean> => {
  const id = await c.rPop(LIST_KEY);
  if (!id) return false;
  await c.del(recordKey(id));
  return true;
};

/**
 * 새 기록을 넣기 전에 목록에서 밀려날 기록의 본문까지 지운다(LTRIM 만 하면 본문이 TTL 동안 남아 무료 30MB 가 찬다, 2026-10-23).
 * 그래도 용량 부족으로 쓰기가 거부되면 오래된 것부터 하나씩 더 지우고 다시 시도한다
 */
export const saveDebug = async (rec: DebugRecord, image: string): Promise<void> => {
  if (process.env.DEBUG_STORE !== '1') return;
  const c = await kv();
  if (!c) return;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const body: DebugRecord = { ...rec, image: image.length <= MAX_IMAGE_CHARS ? image : undefined };
  try {
    while (await c.lLen(LIST_KEY) >= MAX_KEEP) if (!(await dropOldest(c))) break;
    for (;;) {
      try {
        await c.multi().set(recordKey(id), JSON.stringify(body), { EX: TTL_SECONDS }).lPush(LIST_KEY, id).exec();
        return;
      } catch (e) {
        if (!/OOM|EXECABORT|maxmemory/i.test(String(e)) || !(await dropOldest(c))) throw e;
      }
    }
  } catch (e) { console.warn('[debugStore] 진단 저장 실패', e instanceof Error ? e.message : e); }
};
