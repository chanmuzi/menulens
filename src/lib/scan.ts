/** 모델이 준 원시 객체를 검증해 MenuItem / Quad 로 정규화한다. */
import type { Box, Category, MenuItem, OcrWord, Point, Quad } from '../types';
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

export const toMenuItem = (raw: unknown, index: number, words: readonly OcrWord[]): MenuItem | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name_ja = typeof r.name_ja === 'string' ? r.name_ja.trim() : '';
  if (!name_ja) return null;
  const category = CATEGORIES.includes(r.category as Category) ? (r.category as Category) : '안주';
  const price = typeof r.price_jpy === 'number' && Number.isFinite(r.price_jpy) ? Math.round(r.price_jpy) : null;
  const str = (k: string): string => (typeof r[k] === 'string' ? (r[k] as string).trim() : '');
  const ids = Array.isArray(r.word_ids) ? r.word_ids.filter((n): n is number => typeof n === 'number') : [];
  const fromWords = ids.length > 0 ? unionBox(ids, words) : null;
  const fromModel = Array.isArray(r.bbox) && r.bbox.length === 4 ? ([clamp(r.bbox[0]), clamp(r.bbox[1]), clamp(r.bbox[2]), clamp(r.bbox[3])] as const) : null;
  return {
    id: `${index}-${name_ja}`,
    name_ja,
    name_ko: str('name_ko') || name_ja,
    pron_ko: str('pron_ko'),
    price_jpy: price,
    desc_ko: str('desc_ko'),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string').slice(0, 4) : [],
    category,
    icon: resolveIcon(name_ja, str('icon') || undefined, category),
    photo_query: str('photo_query') || name_ja,
    bbox: fromWords ?? fromModel,
  };
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
