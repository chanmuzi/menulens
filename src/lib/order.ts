/** 주문 수량과 주문 문구. 메뉴판(kind=menu)에서만 쓴다. 수량은 스캔별로 localStorage 에 둔다(작은 값). */
import type { MenuItem, Rate, Scan } from '../types';
import { payableJpy } from './money';

export type Order = Readonly<Record<string, number>>;
export type OrderLine = { readonly item: MenuItem; readonly qty: number };

const KEY = (scanId: string) => `menulens.order.${scanId}`;

export const loadOrder = (scanId: string): Order => {
  try { const raw = localStorage.getItem(KEY(scanId)); return raw ? (JSON.parse(raw) as Order) : {}; } catch { return {}; }
};
export const saveOrder = (scanId: string, order: Order): void => {
  try { if (Object.keys(order).length === 0) localStorage.removeItem(KEY(scanId)); else localStorage.setItem(KEY(scanId), JSON.stringify(order)); } catch { /* 무시 */ }
};

/** 수량 변경: 0 이하는 항목을 지운다 */
export const withQty = (order: Order, id: string, qty: number): Order => {
  const { [id]: _drop, ...rest } = order;
  return qty > 0 ? { ...rest, [id]: Math.min(99, qty) } : rest;
};

export const orderLines = (scan: Scan, order: Order): readonly OrderLine[] =>
  scan.items.flatMap((item) => (order[item.id] ? [{ item, qty: order[item.id]! }] : []));

export const totalCount = (lines: readonly OrderLine[]): number => lines.reduce((n, l) => n + l.qty, 0);
/** 가격 미표기 항목은 합계에서 뺀다. 그런 항목이 있으면 두 번째 값이 true */
export const totalJpy = (lines: readonly OrderLine[]): readonly [number, boolean] => [
  lines.reduce((n, l) => n + (payableJpy(l.item) ?? 0) * l.qty, 0),
  lines.some((l) => payableJpy(l.item) === null),
];
export const totalKrw = (jpy: number, rate: Rate | null): number | null => (rate ? Math.round(jpy * rate.krwPerJpy) : null);

/** 일본어 개수 세기(ひとつ…とお), 11 이상은 N個 */
const COUNT_JA = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ', 'ななつ', 'やっつ', 'ここのつ', 'とお'];
const COUNT_KO = ['', '히토츠', '후타츠', '밋츠', '욧츠', '이츠츠', '뭇츠', '나나츠', '얏츠', '코코노츠', '토오'];
const countJa = (n: number): string => COUNT_JA[n] ?? `${n}個`;
const countKo = (n: number): string => COUNT_KO[n] ?? `${n}코`;

const pronOf = (it: MenuItem): string => it.pron_ko || it.name_ko.replace(/\s*[(（].*?[)）]\s*$/, '');

export type OrderText = { readonly ja: string; readonly pron: string; readonly ko: string };

/** 직원에게 보여줄 일본어 · 읽을 수 있는 한글 발음 · 뜻 */
export const buildOrderText = (lines: readonly OrderLine[]): OrderText => {
  const ja = `すみません、注文お願いします。\n${lines.map((l) => `${l.item.name_ja} ${countJa(l.qty)}`).join('、\n')}。\n以上です。`;
  const pron = `스미마셍, 츄-몬 오네가이시마스.\n${lines.map((l) => `${pronOf(l.item)} ${countKo(l.qty)}`).join(',\n')}.\n이죠-데스.`;
  const ko = `실례합니다, 주문할게요.\n${lines.map((l) => `${l.item.name_ko} ${l.qty}개`).join(',\n')}.\n이상입니다.`;
  return { ja, pron, ko };
};
