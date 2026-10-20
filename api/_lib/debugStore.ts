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

export const saveDebug = async (rec: DebugRecord, image: string): Promise<void> => {
  if (process.env.DEBUG_STORE !== '1') return;
  const c = await kv();
  if (!c) return;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const body: DebugRecord = { ...rec, image: image.length <= MAX_IMAGE_CHARS ? image : undefined };
  try {
    await c.multi()
      .set(`menulens:debug:${id}`, JSON.stringify(body), { EX: TTL_SECONDS })
      .lPush(LIST_KEY, id)
      .lTrim(LIST_KEY, 0, MAX_KEEP - 1)
      .exec();
  } catch { /* 진단 저장 실패는 무시 */ }
};
