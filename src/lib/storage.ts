/** localStorage 래퍼. 모든 읽기/쓰기는 실패해도 앱이 동작하도록 try/catch 로 감싼다. */
import type { ImageMode, Photo, Rate, Scan } from '../types';

const KEY = {
  code: 'menulens.accessCode',
  scans: 'menulens.scans',
  rate: 'menulens.rate',
  photos: 'menulens.photos',
  mode: 'menulens.imageMode',
} as const;

const MAX_SCANS = 5;

const read = <T,>(key: string): T | null => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
};
const write = (key: string, value: unknown): boolean => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};

export const getAccessCode = (): string | null => read<string>(KEY.code);
export const setAccessCode = (code: string | null): void => { if (code === null) localStorage.removeItem(KEY.code); else write(KEY.code, code); };

export const loadScans = (): readonly Scan[] => read<Scan[]>(KEY.scans) ?? [];

/** 같은 id 는 교체, 최신이 앞. 용량 초과 시 오래된 것부터 버리며 재시도. */
export const saveScan = (scan: Scan): readonly Scan[] => {
  const rest = loadScans().filter((s) => s.id !== scan.id);
  let next = [scan, ...rest].slice(0, MAX_SCANS);
  while (!write(KEY.scans, next) && next.length > 1) next = next.slice(0, -1);
  return next;
};

export const removeScan = (id: string): readonly Scan[] => {
  const next = loadScans().filter((s) => s.id !== id);
  write(KEY.scans, next);
  return next;
};

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
