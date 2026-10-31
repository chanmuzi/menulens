/**
 * 저장된 스캔을 지금 형식으로. 빈 스캔의 기본값과, 이전 버전에 저장된 기록(빠진 필드·옛 필드 이름)을 채우는 변환.
 * 2026-10-31 필드 중립화: name_ja/name_ko/price_jpy/price_tax_jpy/pron_ko/desc_ko → name/tr/price/price_tax/pron/desc,
 * text_ja/text_ko → text/tr. 그 전 기록은 전부 일→한·엔화라 lang/currency 가 없으면 그 값으로 본다.
 */
import type { MenuItem, Note, Scan, ScanLang } from '../types';
import { newScanId } from './scan';

export const DEFAULT_LANG: ScanLang = { src: 'ja', dst: 'ko' };

export const emptyScan = (): Scan => ({
  id: newScanId(), batchId: null, createdAt: Date.now(), imageDataUrl: '', width: 4, height: 3, kind: 'menu', kindKnown: false, shopName: null, autoTitle: null, userTitle: null, thumb: null, sheetQuad: null,
  lang: DEFAULT_LANG, currency: 'JPY',
  words: [], rotation: 0, tilt: 0, notes: [], summary: null, groups: null, items: [], status: 'preparing', error: null,
  timing: { ocrMs: null, firstItemMs: null, listMs: null, totalMs: null },
});

type Old = Record<string, unknown>;
const OLD_KEYS = ['name_ja', 'name_ko', 'price_jpy', 'price_tax_jpy', 'pron_ko', 'desc_ko', 'text_ja', 'text_ko'] as const;
/** 옛 필드를 뺀 나머지(다시 저장할 때 옛 키가 남지 않게) */
const withoutOld = <T>(raw: T): T => Object.fromEntries(Object.entries(raw as Old).filter(([k]) => !(OLD_KEYS as readonly string[]).includes(k))) as T;
const s = (o: Old, ...keys: readonly string[]): string => { for (const k of keys) { const v = o[k]; if (typeof v === 'string') return v; } return ''; };
const n = (o: Old, ...keys: readonly string[]): number | null => { for (const k of keys) { const v = o[k]; if (typeof v === 'number') return v; if (v === null) return null; } return null; };

/** 항목 하나: 옛 필드 이름을 지금 이름으로, 빠진 상세는 빈 값으로 */
export const upgradeItem = (raw: MenuItem): MenuItem => {
  const o = raw as unknown as Old;
  const name = s(o, 'name', 'name_ja');
  return {
    ...withoutOld(raw),
    name,
    tr: s(o, 'tr', 'name_ko') || name,
    price: n(o, 'price', 'price_jpy'),
    price_tax: n(o, 'price_tax', 'price_tax_jpy'),
    group: raw.group ?? null,
    pron: s(o, 'pron', 'pron_ko'),
    desc: s(o, 'desc', 'desc_ko'),
    tags: raw.tags ?? [],
    photo_query: s(o, 'photo_query') || name,
    detailed: raw.detailed ?? true,
  };
};

export const upgradeNote = (raw: Note): Note => {
  const o = raw as unknown as Old;
  const text = s(o, 'text', 'text_ja');
  return { ...withoutOld(raw), text, tr: s(o, 'tr', 'text_ko') || text };
};

/** 이전 버전에 저장된 스캔도 열리도록 빠진 필드를 채운다 */
export const upgrade = (raw: Scan): Scan => ({
  ...emptyScan(), ...raw, batchId: raw.batchId ?? null,
  // 설명 도중 저장된 스캔은 다시 열 때 「설명 쓰는 중」이 영원히 깜빡이지 않도록 완료로 본다
  status: raw.status === 'error' ? 'error' : 'done',
  lang: raw.lang ?? DEFAULT_LANG, currency: raw.currency ?? 'JPY',
  words: raw.words ?? [], rotation: raw.rotation ?? 0, tilt: raw.tilt ?? 0, kind: raw.kind ?? 'menu', kindKnown: true, sheetQuad: raw.sheetQuad ?? null,
  notes: (raw.notes ?? []).map(upgradeNote), summary: raw.summary ?? null, groups: raw.groups ?? null,
  items: (raw.items ?? []).map(upgradeItem),
  timing: { ...emptyScan().timing, ...(raw.timing ?? {}) },
});
