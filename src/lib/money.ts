import type { MenuItem, Rate } from '../types';

export const formatJpy = (v: number | null): string => (v === null ? '가격 미표기' : `¥${v.toLocaleString('ja-JP')}`);

/** 원화 환산. 100원 단위로 반올림해 "대략" 느낌을 유지한다. */
export const formatKrw = (jpy: number | null, rate: Rate | null): string | null => {
  if (jpy === null || rate === null) return null;
  const krw = Math.round((jpy * rate.krwPerJpy) / 100) * 100;
  return `≈ ₩${krw.toLocaleString('ko-KR')}`;
};

export const formatRateLine = (rate: Rate | null): string | null =>
  rate ? `1¥ ≈ ${rate.krwPerJpy.toFixed(1)}₩` : null;

/** 실제로 내는 금액: 세금 포함가가 따로 있으면 그것 */
export const payableJpy = (it: Pick<MenuItem, 'price_jpy' | 'price_tax_jpy'>): number | null => it.price_tax_jpy ?? it.price_jpy;

/** 메뉴판 표기 그대로: ¥380 (¥418). 세금 포함가가 없으면 ¥380, 가격이 없으면 '가격 미표기' */
export const formatPrice = (it: Pick<MenuItem, 'price_jpy' | 'price_tax_jpy'>): string =>
  it.price_jpy === null ? formatJpy(it.price_tax_jpy) : it.price_tax_jpy !== null ? `${formatJpy(it.price_jpy)} (${formatJpy(it.price_tax_jpy)})` : formatJpy(it.price_jpy);

/** 목록·배지용: 가격이 없으면 빈칸 (「가격 미표기」가 제목급 항목에서 어색하다) */
export const formatPriceOrBlank = (it: Pick<MenuItem, 'price_jpy' | 'price_tax_jpy'>): string => (payableJpy(it) === null ? '' : formatPrice(it));
