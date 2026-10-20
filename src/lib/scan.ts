/** 모델이 준 원시 객체를 검증해 MenuItem / Note / Quad 로 정규화한다. */
import type { Box, Category, MenuItem, Note, OcrWord, Point, Quad } from '../types';
import { resolveIcon } from './icons';

const CATEGORIES: readonly Category[] = ['안주', '식사', '음료', '디저트', '기타'];

const clamp = (n: unknown): number => Math.max(0, Math.min(1000, Number.isFinite(Number(n)) ? Number(n) : 0));

/** OCR 단어 id 목록 → 단어 상자들의 합집합 */
export const unionBox = (ids: readonly number[], words: readonly OcrWord[]): Box | null => {
  const boxes = ids.map((id) => words.find((w) => w.id === id)?.box).filter((b): b is Box => b !== undefined);
  if (boxes.length === 0) return null;
  return [
    Math.min(...boxes.map((b) => b[0])), Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])), Math.max(...boxes.map((b) => b[3])),
  ];
};

const str = (r: Record<string, unknown>, k: string): string => (typeof r[k] === 'string' ? (r[k] as string).trim() : '');

/** word_ids(OCR 모드) 또는 bbox(이미지 폴백) 에서 상자를 얻는다 */
const boxOf = (r: Record<string, unknown>, words: readonly OcrWord[]): Box | null => {
  const ids = Array.isArray(r.word_ids) ? r.word_ids.filter((n): n is number => typeof n === 'number') : [];
  const fromWords = ids.length > 0 ? unionBox(ids, words) : null;
  if (fromWords) return fromWords;
  return Array.isArray(r.bbox) && r.bbox.length === 4 ? [clamp(r.bbox[0]), clamp(r.bbox[1]), clamp(r.bbox[2]), clamp(r.bbox[3])] : null;
};

/** 1단계 항목 → MenuItem (상세는 비워 둠) */
export const toMenuItem = (raw: unknown, key: string, words: readonly OcrWord[]): MenuItem | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name_ja = str(r, 'name_ja');
  if (!name_ja) return null;
  const category = CATEGORIES.includes(r.category as Category) ? (r.category as Category) : '안주';
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
  const price = num(r.price_jpy);
  const tax = num(r.price_tax_jpy);
  return {
    id: key,
    name_ja,
    name_ko: str(r, 'name_ko') || name_ja,
    price_jpy: price,
    price_tax_jpy: tax !== null && tax !== price ? tax : null,
    category,
    icon: category === '기타' ? 'dish' : resolveIcon(name_ja, str(r, 'icon') || undefined, category),
    bbox: boxOf(r, words),
    pron_ko: str(r, 'pron_ko'),
    desc_ko: str(r, 'desc_ko'),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string').slice(0, 4) : [],
    photo_query: str(r, 'photo_query') || name_ja,
    detailed: false,
  };
};

/** 항목 키 "묶음:순번" → 읽기 순서 정렬용 숫자 */
const keyOrder = (key: string): number => {
  const [c, p] = key.split(':').map(Number);
  return (c ?? 0) * 10000 + (p ?? 0);
};

/** 묶음별로 도착하는 항목을 읽기 순서로 끼워 넣는다 */
export const insertItem = (items: readonly MenuItem[], item: MenuItem): readonly MenuItem[] =>
  [...items, item].sort((a, b) => keyOrder(a.id) - keyOrder(b.id));

/** 2단계 상세를 key 로 찾아 합친다 */
export const applyDetails = (items: readonly MenuItem[], details: readonly unknown[]): readonly MenuItem[] => {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const d of details) {
    if (typeof d === 'object' && d !== null && typeof (d as { key?: unknown }).key === 'string') byKey.set((d as { key: string }).key, d as Record<string, unknown>);
  }
  return items.map((it) => {
    const d = byKey.get(it.id);
    if (!d) return it;
    return {
      ...it,
      pron_ko: str(d, 'pron_ko') || it.pron_ko,
      desc_ko: str(d, 'desc_ko') || it.desc_ko,
      tags: Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === 'string').slice(0, 4) : it.tags,
      photo_query: str(d, 'photo_query') || it.photo_query,
      detailed: true,
    };
  });
};

export const toNote = (raw: unknown, words: readonly OcrWord[]): Note | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const text_ja = str(r, 'text_ja');
  if (!text_ja) return null;
  return { text_ja, text_ko: str(r, 'text_ko') || text_ja, bbox: boxOf(r, words) };
};

const toPoint = (p: unknown): Point | null =>
  Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(Number(n))) ? [clamp(p[0]), clamp(p[1])] : null;

export const toQuad = (raw: unknown): Quad | null => {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const pts = raw.map(toPoint);
  if (pts.some((p) => p === null)) return null;
  const [a, b, c, d] = pts as Point[];
  const w = Math.max(b![0], c![0]) - Math.min(a![0], d![0]);
  const h = Math.max(c![1], d![1]) - Math.min(a![1], b![1]);
  return w > 250 && h > 250 ? [a!, b!, c!, d!] : null;
};

export const newScanId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
