/** 모델이 준 원시 객체를 검증해 MenuItem / Quad 로 정규화한다. */
import type { Category, MenuItem, Point, Quad } from '../types';
import { resolveIcon } from './icons';

const CATEGORIES: readonly Category[] = ['안주', '식사', '음료', '디저트'];

const clamp = (n: unknown): number => Math.max(0, Math.min(1000, Number.isFinite(Number(n)) ? Number(n) : 0));

export const toMenuItem = (raw: unknown, index: number): MenuItem | null => {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const name_ja = typeof r.name_ja === 'string' ? r.name_ja.trim() : '';
  if (!name_ja) return null;
  const category = CATEGORIES.includes(r.category as Category) ? (r.category as Category) : '안주';
  const bboxRaw = Array.isArray(r.bbox) && r.bbox.length === 4 ? r.bbox : [0, 0, 0, 0];
  const price = typeof r.price_jpy === 'number' && Number.isFinite(r.price_jpy) ? Math.round(r.price_jpy) : null;
  const str = (k: string): string => (typeof r[k] === 'string' ? (r[k] as string).trim() : '');
  return {
    id: `${index}-${name_ja}`,
    name_ja,
    name_ko: str('name_ko') || name_ja,
    pron_ko: str('pron_ko'),
    price_jpy: price,
    desc_ko: str('desc_ko'),
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string').slice(0, 4) : [],
    category,
    icon: resolveIcon(str('icon') || undefined, category),
    photo_query: str('photo_query') || name_ja,
    bbox: [clamp(bboxRaw[0]), clamp(bboxRaw[1]), clamp(bboxRaw[2]), clamp(bboxRaw[3])],
  };
};

const toPoint = (p: unknown): Point | null =>
  Array.isArray(p) && p.length === 2 && p.every((n) => Number.isFinite(Number(n))) ? [clamp(p[0]), clamp(p[1])] : null;

export const toQuad = (raw: unknown): Quad | null => {
  if (!Array.isArray(raw) || raw.length !== 4) return null;
  const pts = raw.map(toPoint);
  if (pts.some((p) => p === null)) return null;
  const [a, b, c, d] = pts as Point[];
  // 너무 작은 사각형(사진의 1/16 미만)은 오인식으로 보고 무시
  const w = Math.max(b![0], c![0]) - Math.min(a![0], d![0]);
  const h = Math.max(c![1], d![1]) - Math.min(a![1], b![1]);
  return w > 250 && h > 250 ? [a!, b!, c!, d!] : null;
};

export const newScanId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
