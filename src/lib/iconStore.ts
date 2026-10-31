/**
 * 생성된 도트 아이콘 저장소. 기기(localStorage)에 메뉴명 → 격자를 두고, 없으면 서버(/api/icon)에 묶어서 요청한다.
 * 같은 이름은 한 번만 요청하고, 300ms 안에 모인 요청은 한 번에 보낸다.
 */
import { useEffect, useState } from 'react';
import { fetchIcons } from './api';
import { isGrid } from './pixel';

const KEY = 'menulens.icons.v1';
type Store = Record<string, readonly string[]>;

const load = (): Store => { try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Store) : {}; } catch { return {}; } };
const save = (s: Store): void => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 용량 초과 등은 무시 */ } };

let store: Store = load();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const getGeneratedIcon = (nameJa: string): readonly string[] | null => store[nameJa] ?? null;

/** 실패한 이름은 세션 동안 다시 묻지 않는다 */
const failed = new Set<string>();
const pending = new Map<string, { tr: string; hint: string }>();
let timer: number | null = null;

const flush = async () => {
  timer = null;
  const batch = [...pending.entries()].slice(0, 12);
  batch.forEach(([k]) => pending.delete(k));
  if (batch.length === 0) return;
  try {
    const res = await fetchIcons(batch.map(([name, v]) => ({ name, tr: v.tr, hint: v.hint })));
    const next: Store = { ...store };
    for (const [name, grid] of Object.entries(res.icons)) if (isGrid(grid)) next[name] = grid;
    for (const name of res.failed) failed.add(name);
    batch.forEach(([k]) => { if (!next[k]) failed.add(k); });
    store = next; save(store); notify();
  } catch {
    batch.forEach(([k]) => failed.add(k));
  }
  if (pending.size > 0) timer = window.setTimeout(() => void flush(), 50);
};

export const requestIcon = (nameJa: string, nameKo: string, hint = ''): void => {
  if (store[nameJa] || failed.has(nameJa) || pending.has(nameJa)) return;
  pending.set(nameJa, { tr: nameKo, hint });
  if (timer === null) timer = window.setTimeout(() => void flush(), 300);
};

/** 생성 아이콘 구독. enabled 면 없을 때 요청한다 */
export const useGeneratedIcon = (nameJa: string, nameKo: string, enabled: boolean): readonly string[] | null => {
  const [grid, setGrid] = useState<readonly string[] | null>(() => getGeneratedIcon(nameJa));
  useEffect(() => {
    setGrid(getGeneratedIcon(nameJa));
    if (!enabled) return;
    const l = () => setGrid(getGeneratedIcon(nameJa));
    listeners.add(l);
    requestIcon(nameJa, nameKo);
    return () => { listeners.delete(l); };
  }, [nameJa, nameKo, enabled]);
  return grid;
};
