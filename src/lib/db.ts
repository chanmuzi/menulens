/**
 * 스캔 기록용 IndexedDB 래퍼. localStorage(≈5MB) 와 달리 디스크 기준 쿼터라 사진이 든 기록을 수백 건 보관할 수 있다.
 * 객체 저장소 둘: `scans`(목록·결과, 사진 제외) 와 `images`(id → 사진 data URL). 목록을 읽을 때 수백 KB 짜리 사진을
 * 전부 메모리에 올리지 않기 위해 나눴다. 사진은 결과 화면을 열 때 `dbLoadImage` 로 한 건만 읽는다.
 * 모든 함수는 실패 시 reject 한다. 폴백(localStorage)은 storage.ts 가 맡는다.
 */
import type { Scan } from '../types';

const DB_NAME = 'menulens';
const DB_VERSION = 1;
const SCANS = 'scans';
const IMAGES = 'images';

export const hasIndexedDb = (): boolean => typeof indexedDB !== 'undefined';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!hasIndexedDb()) { reject(new Error('IndexedDB 없음')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SCANS)) db.createObjectStore(SCANS, { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      if (!db.objectStoreNames.contains(IMAGES)) db.createObjectStore(IMAGES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 열기 실패'));
    req.onblocked = () => reject(new Error('IndexedDB 가 다른 탭에 잠겨 있음'));
  });

/** 트랜잭션 하나를 열어 작업을 실행하고 완료를 기다린 뒤 닫는다. 결과는 op 가 돌려준 요청의 result */
const run = async <T,>(mode: IDBTransactionMode, stores: readonly string[], op: (tx: IDBTransaction) => IDBRequest<T> | null): Promise<T | undefined> => {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction([...stores], mode);
      const req = op(tx);
      let result: T | undefined;
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 요청 실패'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 트랜잭션 중단'));
    });
  } finally {
    db.close();
  }
};

/** 전체 기록(사진 없이, imageDataUrl 은 ''), 최신이 앞 */
export const dbLoadScans = async (): Promise<readonly Scan[]> => {
  const all = (await run<Scan[]>('readonly', [SCANS], (tx) => tx.objectStore(SCANS).getAll())) ?? [];
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
};

/** 사진 한 건. 없으면 null */
export const dbLoadImage = async (id: string): Promise<string | null> =>
  (await run<string | undefined>('readonly', [IMAGES], (tx) => tx.objectStore(IMAGES).get(id))) ?? null;

/** 목록 레코드와 사진을 한 트랜잭션에 넣는다 */
export const dbPutScan = (scan: Scan): Promise<unknown> =>
  run('readwrite', [SCANS, IMAGES], (tx) => {
    tx.objectStore(SCANS).put({ ...scan, imageDataUrl: '' });
    if (scan.imageDataUrl) tx.objectStore(IMAGES).put(scan.imageDataUrl, scan.id);
    return null;
  });

export const dbDeleteScan = (id: string): Promise<unknown> =>
  run('readwrite', [SCANS, IMAGES], (tx) => { tx.objectStore(SCANS).delete(id); tx.objectStore(IMAGES).delete(id); return null; });

export const dbClearScans = (): Promise<unknown> =>
  run('readwrite', [SCANS, IMAGES], (tx) => { tx.objectStore(SCANS).clear(); tx.objectStore(IMAGES).clear(); return null; });
