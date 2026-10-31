import type { MenuItem, Rate } from '../types';
import { dict } from '../i18n';

export const formatJpy = (v: number | null): string => (v === null ? dict().data.noPrice : `¥${v.toLocaleString('ja-JP')}`);

/** 원화 환산. 100원 단위로 반올림해 "대략" 느낌을 유지한다. */
export const formatKrw = (jpy: number | null, rate: Rate | null): string | null => {
  if (jpy === null || rate === null) return null;
  const krw = Math.round((jpy * rate.krwPerJpy) / 100) * 100;
  return `≈ ₩${krw.toLocaleString('ko-KR')}`;
};

export const formatRateLine = (rate: Rate | null): string | null =>
  rate ? `1¥ ≈ ${rate.krwPerJpy.toFixed(1)}₩` : null;

/** 실제로 내는 금액: 세금 포함가가 따로 있으면 그것 */
export const payableJpy = (it: Pick<MenuItem, 'price' | 'price_tax'>): number | null => it.price_tax ?? it.price;

/** 메뉴판 표기 그대로: ¥380 (¥418). 세금 포함가가 없으면 ¥380, 가격이 없으면 '가격 미표기' */
export const formatPrice = (it: Pick<MenuItem, 'price' | 'price_tax'>): string =>
  it.price === null ? formatJpy(it.price_tax) : it.price_tax !== null ? `${formatJpy(it.price)} (${formatJpy(it.price_tax)})` : formatJpy(it.price);

/** 목록·배지용: 가격이 없으면 빈칸 (「가격 미표기」가 제목급 항목에서 어색하다) */
export const formatPriceOrBlank = (it: Pick<MenuItem, 'price' | 'price_tax'>): string => (payableJpy(it) === null ? '' : formatPrice(it));

/**
 * 글 속 엔화 금액을 찾아 조각으로 나눈다(「1만 엔」「598엔」「¥598」「1,000円」). 요약 옆에 원화 환산을 붙일 때 쓴다.
 * 금액 조각은 jpy 가 숫자, 나머지는 null.
 */
export const splitYen = (text: string): ReadonlyArray<{ readonly text: string; readonly jpy: number | null }> => {
  const re = /¥\s?(\d[\d,]*)|(\d[\d,]*(?:\.\d+)?)\s*(만|万)?\s*(?:엔|円)/g;
  const out: Array<{ text: string; jpy: number | null }> = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    const num = Number((m[1] ?? m[2] ?? '').replace(/,/g, ''));
    if (!Number.isFinite(num) || num <= 0) continue;
    if (at > last) out.push({ text: text.slice(last, at), jpy: null });
    out.push({ text: m[0], jpy: Math.round(m[3] ? num * 10000 : num) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), jpy: null });
  return out;
};
