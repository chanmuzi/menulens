/** 영속 저장 래퍼. 스캔 기록은 IndexedDB(db.ts), 나머지는 localStorage. 모든 읽기/쓰기는 실패해도 앱이 동작하도록 감싼다. */
import type { ImageMode, Photo, Rate, Scan } from '../types';
import { dbClearScans, dbDeleteScan, dbLoadImage, dbLoadScans, dbPutScan } from './db';

const KEY = {
  code: 'menulens.accessCode',
  scans: 'menulens.scans',
  rate: 'menulens.rate',
  photos: 'menulens.photos',
  mode: 'menulens.imageMode',
} as const;

/** IndexedDB 를 못 쓰는 환경(옛 Safari 사생활 보호 모드 등)에서만 쓰는 localStorage 폴백의 보관 한도 */
const MAX_SCANS_FALLBACK = 5;

const read = <T,>(key: string): T | null => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
};
const write = (key: string, value: unknown): boolean => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};
const remove = (key: string): void => { try { localStorage.removeItem(key); } catch { /* 무시 */ } };

export const getAccessCode = (): string | null => read<string>(KEY.code);
export const setAccessCode = (code: string | null): void => { if (code === null) remove(KEY.code); else write(KEY.code, code); };

// ── 스캔 기록: IndexedDB 가 정본, 실패 시 localStorage(5건) 폴백 ──────────────────
// 두 저장소에 동시에 기록이 있을 수 있다(이관 실패·일시 오류). 목록은 항상 둘을 합쳐 돌려줘
// IndexedDB 오류 한 번에 기록이 사라져 보이지 않게 한다.

const legacyLoad = (): readonly Scan[] => read<Scan[]>(KEY.scans) ?? [];

/** 같은 id 는 교체, 최신이 앞. 용량 초과 시 오래된 것부터 버리며 재시도. */
const legacySave = (scan: Scan): readonly Scan[] => {
  const rest = legacyLoad().filter((s) => s.id !== scan.id);
  let next = [scan, ...rest].slice(0, MAX_SCANS_FALLBACK);
  while (!write(KEY.scans, next) && next.length > 1) next = next.slice(0, -1);
  return next;
};

/** localStorage 에 남은 기록을 IndexedDB 로 옮긴다. 전부 옮겨졌을 때만 원본을 지우고, 실패하면 다음 실행에 다시 시도한다. */
const migrateLegacy = async (): Promise<void> => {
  const legacy = legacyLoad();
  if (legacy.length === 0) return;
  await Promise.all(legacy.map((s) => dbPutScan(s)));
  remove(KEY.scans);
};

/** IndexedDB 목록 + 아직 localStorage 에 남은 것(중복 제외), 최신이 앞 */
const mergedList = async (): Promise<readonly Scan[]> => {
  const db = await dbLoadScans().catch((): readonly Scan[] => []);
  const ids = new Set(db.map((s) => s.id));
  return [...db, ...legacyLoad().filter((s) => !ids.has(s.id))].sort((a, b) => b.createdAt - a.createdAt);
};

export const loadScans = async (): Promise<readonly Scan[]> => {
  await migrateLegacy().catch(() => { /* 다음 실행에 재시도 */ });
  return mergedList();
};

export const saveScan = async (scan: Scan): Promise<readonly Scan[]> => {
  try { await dbPutScan(scan); } catch { legacySave(scan); }
  return mergedList();
};

export const removeScan = async (id: string): Promise<readonly Scan[]> => {
  await dbDeleteScan(id).catch(() => { /* 아래 localStorage 쪽도 지운다 */ });
  const legacy = legacyLoad();
  if (legacy.some((s) => s.id === id)) write(KEY.scans, legacy.filter((s) => s.id !== id));
  return mergedList();
};

export const clearScans = async (): Promise<readonly Scan[]> => {
  await dbClearScans().catch(() => { /* 폴백 쪽만이라도 */ });
  remove(KEY.scans);
  return mergedList();
};

/** 결과 화면용 사진. IndexedDB 에 없으면(폴백 저장) 목록 레코드에 든 값을 그대로 쓴다 */
export const loadScanImage = async (scan: Scan): Promise<string> =>
  scan.imageDataUrl || ((await dbLoadImage(scan.id).catch(() => null)) ?? '');

type CachedRate = Rate & { readonly fetchedAt: number };
const RATE_TTL = 12 * 60 * 60 * 1000;
export const loadRate = (): Rate | null => {
  const r = read<CachedRate>(KEY.rate);
  return r && Date.now() - r.fetchedAt < RATE_TTL ? r : null;
};
export const saveRate = (rate: Rate): void => { write(KEY.rate, { ...rate, fetchedAt: Date.now() }); };

export const loadPhoto = (query: string): Photo | null => (read<Record<string, Photo>>(KEY.photos) ?? {})[query] ?? null;
export const savePhoto = (query: string, photo: Photo): void => {
  const all = read<Record<string, Photo>>(KEY.photos) ?? {};
  write(KEY.photos, { ...all, [query]: photo });
};

export const loadImageMode = (): ImageMode => read<ImageMode>(KEY.mode) ?? 'art';
export const saveImageMode = (mode: ImageMode): void => { write(KEY.mode, mode); };
