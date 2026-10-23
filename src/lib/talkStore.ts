/**
 * 대화 기록 저장. 스캔 기록(db.ts 의 `menulens` DB)과 섞이지 않게 IndexedDB 를 따로 둔다(`menulens-talk`, 저장소 `talks`).
 * 기존 스캔 저장 형식·버전은 건드리지 않는다. IndexedDB 를 못 쓰면 localStorage 에 최근 것만 보관한다.
 */
import type { Talk } from '../types';
import { hasIndexedDb } from './db';

const DB_NAME = 'menulens-talk';
const STORE = 'talks';
const FALLBACK_KEY = 'menulens.talks';
const MAX_FALLBACK = 20;

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!hasIndexedDb()) { reject(new Error('IndexedDB 없음')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 열기 실패'));
    req.onblocked = () => reject(new Error('IndexedDB 가 다른 탭에 잠겨 있음'));
  });

const run = async <T,>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T> | null): Promise<T | undefined> => {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      let result: T | undefined;
      if (req) req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 요청 실패'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 트랜잭션 중단'));
    });
  } finally { db.close(); }
};

const readFallback = (): readonly Talk[] => {
  try { const raw = localStorage.getItem(FALLBACK_KEY); return raw ? (JSON.parse(raw) as Talk[]) : []; } catch { return []; }
};
const writeFallback = (list: readonly Talk[]): void => {
  try { localStorage.setItem(FALLBACK_KEY, JSON.stringify(list.slice(0, MAX_FALLBACK))); } catch { /* 저장 못 해도 화면의 대화는 이어진다 */ }
};

const byRecent = (list: readonly Talk[]): readonly Talk[] => [...list].sort((a, b) => b.updatedAt - a.updatedAt);

/** 전체 대화, 최근에 이어 말한 것이 앞 */
export const loadTalks = async (): Promise<readonly Talk[]> => {
  const db = await run<Talk[]>('readonly', (s) => s.getAll()).catch((): Talk[] | undefined => undefined);
  if (db === undefined) return byRecent(readFallback());
  const ids = new Set(db.map((t) => t.id));
  return byRecent([...db, ...readFallback().filter((t) => !ids.has(t.id))]);
};

/** 저장은 순서대로(번역이 연달아 끝나면 저장이 겹친다) */
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
  const next = queue.then(job);
  queue = next.catch(() => undefined);
  return next;
};

export const saveTalk = (talk: Talk): Promise<readonly Talk[]> =>
  enqueue(async () => {
    try { await run('readwrite', (s) => { s.put(talk); return null; }); } catch { writeFallback([talk, ...readFallback().filter((t) => t.id !== talk.id)]); }
    return loadTalks();
  });

export const removeTalk = (id: string): Promise<readonly Talk[]> =>
  enqueue(async () => {
    await run('readwrite', (s) => { s.delete(id); return null; }).catch(() => undefined);
    const fb = readFallback();
    if (fb.some((t) => t.id === id)) writeFallback(fb.filter((t) => t.id !== id));
    return loadTalks();
  });
