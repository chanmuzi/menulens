import type { Rate } from '../types';

export const formatJpy = (v: number | null): string => (v === null ? '가격 미표기' : `¥${v.toLocaleString('ja-JP')}`);

/** 원화 환산. 100원 단위로 반올림해 "대략" 느낌을 유지한다. */
export const formatKrw = (jpy: number | null, rate: Rate | null): string | null => {
  if (jpy === null || rate === null) return null;
  const krw = Math.round((jpy * rate.krwPerJpy) / 100) * 100;
  return `≈ ₩${krw.toLocaleString('ko-KR')}`;
};

export const formatRateLine = (rate: Rate | null): string | null =>
  rate ? `1¥ ≈ ${rate.krwPerJpy.toFixed(1)}₩` : null;
