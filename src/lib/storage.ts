/** 영속 저장 래퍼. 스캔 기록은 IndexedDB(db.ts), 나머지는 localStorage. 모든 읽기/쓰기는 실패해도 앱이 동작하도록 감싼다. */
import type { ImageMode, Photo, Rate, Scan, TalkPair } from '../types';
import { dbClearScans, dbDeleteScan, dbLoadImage, dbLoadScans, dbPatchScan, dbPutScan } from './db';
import { makeThumb } from './thumb';

const KEY = {
  code: 'menulens.accessCode',
  scans: 'menulens.scans',
  rate: 'menulens.rate',
  photos: 'menulens.photos',
  mode: 'menulens.imageMode',
  homeTab: 'menulens.homeTab',
  talkPrefs: 'menulens.talkPrefs',
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

/** 저장은 순서대로 한다. 여러 장을 동시에 읽으면 완료가 겹치는데, 병렬로 저장하면 먼저 읽은 목록이 나중에 도착해 한 건이 빠져 보인다 */
let saveQueue: Promise<unknown> = Promise.resolve();
const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
  const next = saveQueue.then(job);
  saveQueue = next.catch(() => undefined);
  return next;
};

/** 저장할 때 목록 썸네일도 같이 만든다(이미 있으면 그대로). 폴백 저장(localStorage)은 용량이 작아 썸네일을 넣지 않는다 */
export const saveScan = (scan: Scan): Promise<readonly Scan[]> =>
  enqueue(async () => {
    try {
      const thumb = scan.thumb ?? (await makeThumb(scan.id, scan.imageDataUrl, scan.rotation));
      await dbPutScan({ ...scan, thumb });
    } catch { legacySave(scan); }
    return mergedList();
  });

/** 묶음의 이름을 바꾼다. null 이면 자동 제목으로 돌아간다 */
export const renameScans = (ids: readonly string[], userTitle: string | null): Promise<readonly Scan[]> =>
  enqueue(async () => {
    await Promise.all(ids.map((id) => dbPatchScan(id, { userTitle }).catch(() => { /* 폴백 저장 기록은 아래에서 */ })));
    const legacy = legacyLoad();
    if (legacy.some((s) => ids.includes(s.id))) write(KEY.scans, legacy.map((s) => (ids.includes(s.id) ? { ...s, userTitle } : s)));
    return mergedList();
  });

/** 썸네일이 없는 옛 기록에 저장된 사진으로 썸네일을 만들어 채운다. 한 건씩 큐에 넣어(사진은 하나씩만 메모리에) 그 사이 새 스캔 저장·이름 고치기가 끼어들 수 있게 한다 */
export const backfillThumbs = async (scans: readonly Scan[]): Promise<readonly Scan[]> => {
  for (const s of scans) {
    if (s.thumb) continue;
    await enqueue(async () => {
      const img = await dbLoadImage(s.id).catch(() => null);
      const thumb = img ? await makeThumb(s.id, img, s.rotation ?? 0) : null;
      if (thumb) await dbPatchScan(s.id, { thumb }).catch(() => undefined);
    });
  }
  return enqueue(mergedList);
};

/** 스캔에 딸린 localStorage 키(주문·대화)를 함께 지운다 */
const removeAttached = (id: string): void => { remove(`menulens.order.${id}`); remove(`ml.chat.${id}`); };
/** 한 건이든 묶음이든 여기로. 여러 건을 지우고 목록은 한 번만 다시 읽는다 */
export const removeScans = async (ids: readonly string[]): Promise<readonly Scan[]> => {
  ids.forEach(removeAttached);
  await Promise.all(ids.map((id) => dbDeleteScan(id).catch(() => { /* 아래 localStorage 쪽도 지운다 */ })));
  const drop = new Set(ids);
  const legacy = legacyLoad();
  if (legacy.some((s) => drop.has(s.id))) write(KEY.scans, legacy.filter((s) => !drop.has(s.id)));
  return mergedList();
};

export const clearScans = async (): Promise<readonly Scan[]> => {
  try { Object.keys(localStorage).filter((k) => k.startsWith('menulens.order.') || k.startsWith('ml.chat.')).forEach((k) => remove(k)); } catch { /* 무시 */ }
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

/** 홈 탭(메뉴판 읽기 / 대화 통역). 처음은 메뉴판 */
export type HomeTab = 'menu' | 'talk';
export const loadHomeTab = (): HomeTab => (read<HomeTab>(KEY.homeTab) === 'talk' ? 'talk' : 'menu');
export const saveHomeTab = (tab: HomeTab): void => { write(KEY.homeTab, tab); };

// ── 대화 화면 설정(기기별): 말풍선 언어 쌍, 일본어 발음 보기 ──────────────────
export type TalkPrefs = { readonly pair: TalkPair; readonly pron: boolean };
const PAIRS: readonly TalkPair[] = ['ko-ja', 'ko-en', 'ja-en'];

export const loadTalkPrefs = (): TalkPrefs => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY.talkPrefs) ?? '{}') as Partial<TalkPrefs>;
    return { pair: raw.pair && PAIRS.includes(raw.pair) ? raw.pair : 'ko-ja', pron: raw.pron !== false };
  } catch { return { pair: 'ko-ja', pron: true }; }
};
export const saveTalkPrefs = (prefs: TalkPrefs): void => { try { localStorage.setItem(KEY.talkPrefs, JSON.stringify(prefs)); } catch { /* 무시 */ } };
