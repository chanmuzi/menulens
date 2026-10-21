/**
 * 카드 뷰의 묶음. 우선순위: 서버 정리 묶음(`groups` 이벤트, 2단계와 병렬 호출) → 항목별 group(1단계가 붙인 섹션 제목·즉석 이름, 첫 등장 순서) → category.
 * 항목별 group 은 묶음이 너무 적거나(1개) 너무 많거나(MAX 초과) 대부분 항목에 없으면 쓰지 않는다.
 * 서버 묶음 이름은 수신부(App.onGroups)에서 항목 group 과 같은 normalizeGroup 을 거친다.
 */
import type { Category, MenuItem, Scan, ScanGroup } from '../types';

export type Group = { readonly key: string; readonly label: string; readonly items: readonly MenuItem[] };

const MAX_GROUPS = 10;
/** 서버가 묶음 정리를 돌리는 최소 항목 수(api/analyze.ts 의 MIN_ITEMS_FOR_GROUPS 와 같은 값) */
export const MIN_ITEMS_FOR_GROUPS = 8;
const MIN_GROUPED_RATIO = 0.6;
const CATEGORY_ORDER: readonly Category[] = ['식사', '안주', '음료', '디저트', '기타'];
const REST = '그 밖에';

const collect = (items: readonly MenuItem[], keyOf: (it: MenuItem) => string | null): readonly Group[] => {
  const map = new Map<string, MenuItem[]>();
  for (const it of items) {
    const k = keyOf(it) ?? REST;
    const arr = map.get(k);
    if (arr) arr.push(it); else map.set(k, [it]);
  }
  // 「그 밖에」는 맨 뒤로
  const entries = [...map.entries()].sort(([a], [b]) => (a === REST ? 1 : 0) - (b === REST ? 1 : 0));
  return entries.map(([label, list]) => ({ key: `g:${label}`, label, items: list }));
};

/** 모델 묶음을 쓸 수 있는지: 2~MAX 개이고 항목의 60% 이상에 group 이 있을 때 */
const usable = (items: readonly MenuItem[]): boolean => {
  const named = items.filter((it) => it.group !== null);
  const distinct = new Set(named.map((it) => it.group)).size;
  return distinct >= 2 && distinct <= MAX_GROUPS && named.length >= items.length * MIN_GROUPED_RATIO;
};

/** 서버 정리 묶음 → 항목별 임시 group → category 순으로 묶는다 */
/** 서버 묶음 정리가 아직 올 수 있는 동안인가. 이때 묶음 칩을 보여주면 도착 순간 이름이 바뀌어 고른 칩이 튄다 */
export const groupsPending = (scan: Pick<Scan, 'kind' | 'groups' | 'items' | 'status'>): boolean =>
  scan.kind === 'menu' && scan.groups === null && scan.items.length >= MIN_ITEMS_FOR_GROUPS && scan.status !== 'done' && scan.status !== 'error';

export const groupItems = (items: readonly MenuItem[], served: readonly ScanGroup[] | null): readonly Group[] => {
  if (items.length === 0) return [];
  if (served && served.length >= 2) {
    const nameOf = new Map(served.flatMap((g) => g.keys.map((k) => [k, g.name] as const)));
    const order = new Map(served.map((g, i) => [g.name, i] as const));
    const groups = collect(items, (it) => nameOf.get(it.id) ?? null);
    return [...groups].sort((a, b) => (order.get(a.label) ?? 99) - (order.get(b.label) ?? 99));
  }
  if (usable(items)) return collect(items, (it) => it.group);
  const byCat = collect(items, (it) => it.category);
  return CATEGORY_ORDER.flatMap((c) => byCat.filter((g) => g.label === c));
};
