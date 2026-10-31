/** 금액 표시와 환산. 통화는 사진 원문 언어를 따르고(Scan.currency), 환산은 앱 환율(JPY 기준 KRW) 하나로 양방향을 계산한다. */
import type { Currency, MenuItem, Rate } from '../types';
import { dict } from '../i18n';

const SYMBOL: Readonly<Record<Currency, string>> = { JPY: '¥', KRW: '₩' };
const LOCALE: Readonly<Record<Currency, string>> = { JPY: 'ja-JP', KRW: 'ko-KR' };
/** 환산 통화 */
const OTHER: Readonly<Record<Currency, Currency>> = { JPY: 'KRW', KRW: 'JPY' };

export const formatMoney = (v: number | null, currency: Currency): string => (v === null ? dict().data.noPrice : `${SYMBOL[currency]}${v.toLocaleString(LOCALE[currency])}`);

/** 실제로 내는 금액: 세금 포함가가 따로 있으면 그것 */
export const payable = (it: Pick<MenuItem, 'price' | 'price_tax'>): number | null => it.price_tax ?? it.price;

/** 메뉴판 표기 그대로: ¥380 (¥418). 세금 포함가가 없으면 ¥380, 가격이 없으면 '가격 미표기' */
export const formatPrice = (it: Pick<MenuItem, 'price' | 'price_tax'>, currency: Currency): string =>
  it.price === null ? formatMoney(it.price_tax, currency) : it.price_tax !== null ? `${formatMoney(it.price, currency)} (${formatMoney(it.price_tax, currency)})` : formatMoney(it.price, currency);

/** 목록·배지용: 가격이 없으면 빈칸 (「가격 미표기」가 제목급 항목에서 어색하다) */
export const formatPriceOrBlank = (it: Pick<MenuItem, 'price' | 'price_tax'>, currency: Currency): string => (payable(it) === null ? '' : formatPrice(it, currency));

/** 다른 통화로 환산. 엔→원은 100원 단위, 원→엔은 10엔 단위로 반올림해 "대략" 느낌을 유지한다 */
export const convert = (v: number | null, currency: Currency, rate: Rate | null): number | null => {
  if (v === null || rate === null) return null;
  return currency === 'JPY' ? Math.round((v * rate.krwPerJpy) / 100) * 100 : Math.round(v / rate.krwPerJpy / 10) * 10;
};

/** 「≈ ₩1,400」「≈ ¥1,060」 */
export const formatConverted = (v: number | null, currency: Currency, rate: Rate | null): string | null => {
  const c = convert(v, currency, rate);
  return c === null ? null : `≈ ${formatMoney(c, OTHER[currency])}`;
};

/** 결과 화면 부제의 환율 한 줄: 엔화 메뉴판은 「1¥ ≈ 8.5₩」, 원화 메뉴판은 「100₩ ≈ 11.8¥」 */
export const formatRateLine = (rate: Rate | null, currency: Currency): string | null =>
  rate === null ? null : currency === 'JPY' ? `1¥ ≈ ${rate.krwPerJpy.toFixed(1)}₩` : `100₩ ≈ ${(100 / rate.krwPerJpy).toFixed(1)}¥`;

/**
 * 글 속 금액을 찾아 조각으로 나눈다. 엔화: 「1만 엔」「598엔」「¥598」「1,000円」. 원화: 「₩9,000」「9,000원」「1만 원」「9000ウォン」.
 * 금액 조각은 amount 가 숫자, 나머지는 null. 요약 옆에 환산을 붙일 때 쓴다.
 */
export const splitMoney = (text: string, currency: Currency): ReadonlyArray<{ readonly text: string; readonly amount: number | null }> => {
  const re = currency === 'JPY'
    ? /¥\s?(\d[\d,]*)|(\d[\d,]*(?:\.\d+)?)\s*(만|万)?\s*(?:엔|円)/g
    : /₩\s?(\d[\d,]*)|(\d[\d,]*(?:\.\d+)?)\s*(만|万)?\s*(?:원|ウォン)/g;
  const out: Array<{ text: string; amount: number | null }> = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    const num = Number((m[1] ?? m[2] ?? '').replace(/,/g, ''));
    if (!Number.isFinite(num) || num <= 0) continue;
    if (at > last) out.push({ text: text.slice(last, at), amount: null });
    out.push({ text: m[0], amount: Math.round(m[3] ? num * 10000 : num) });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), amount: null });
  return out;
};
