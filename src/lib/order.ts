/** 주문 수량과 주문 문구. 메뉴판(kind=menu)에서만 쓴다. 수량은 사진(스캔)별로 localStorage 에 두고(작은 값), 화면에서는 묶음 전체를 합쳐 하나의 주문서로 본다. */
import type { MenuItem, Rate, Scan } from '../types';
import { payableJpy } from './money';
import { dict } from '../i18n';

/** 사진 한 장의 수량: 항목 id → 수량. 항목 id(「묶음:순번」)는 사진마다 겹치므로 사진 밖에서는 BatchOrder 로 다룬다 */
export type Order = Readonly<Record<string, number>>;
/** 묶음 전체의 수량: 사진(스캔) id → Order. 1번 사진에서 담은 것과 2번 사진에서 담은 것이 한 주문서가 된다 */
export type BatchOrder = Readonly<Record<string, Order>>;
/** 주문서 한 줄. photo 는 묶음 안 사진 번호(1부터, 띠의 번호와 같다) */
export type OrderLine = { readonly scanId: string; readonly photo: number; readonly item: MenuItem; readonly qty: number };

const KEY = (scanId: string) => `menulens.order.${scanId}`;

export const loadOrder = (scanId: string): Order => {
  try { const raw = localStorage.getItem(KEY(scanId)); return raw ? (JSON.parse(raw) as Order) : {}; } catch { return {}; }
};
export const saveOrder = (scanId: string, order: Order): void => {
  try { if (Object.keys(order).length === 0) localStorage.removeItem(KEY(scanId)); else localStorage.setItem(KEY(scanId), JSON.stringify(order)); } catch { /* 무시 */ }
};
/** 묶음의 사진 전부의 저장된 수량. 비어 있는 사진은 넣지 않는다 */
export const loadBatchOrder = (scanIds: readonly string[]): BatchOrder =>
  Object.fromEntries(scanIds.flatMap((id) => { const o = loadOrder(id); return Object.keys(o).length > 0 ? [[id, o] as const] : []; }));
/** 들어 있는 사진마다 저장한다(빈 Order 는 키를 지운다 → 비우기도 여기로 반영된다) */
export const saveBatchOrder = (bo: BatchOrder): void => { for (const [id, o] of Object.entries(bo)) saveOrder(id, o); };

/** 수량 변경: 0 이하는 항목을 지운다 */
export const withQty = (order: Order, id: string, qty: number): Order => {
  const { [id]: _drop, ...rest } = order;
  return qty > 0 ? { ...rest, [id]: Math.min(99, qty) } : rest;
};

/** 묶음 안 한 사진의 수량 변경 */
export const withBatchQty = (bo: BatchOrder, scanId: string, itemId: string, qty: number): BatchOrder => ({ ...bo, [scanId]: withQty(bo[scanId] ?? {}, itemId, qty) });
/** 전부 비우기. 키는 남겨 두어 저장 시 각 사진의 저장 값도 지워지게 한다 */
export const clearedBatchOrder = (bo: BatchOrder): BatchOrder => Object.fromEntries(Object.keys(bo).map((id) => [id, {}]));

/** 묶음 전체의 주문서 줄: 사진 순서대로, 사진 안에서는 메뉴 순서대로. 메뉴판이 아닌 사진은 건너뛴다 */
export const batchLines = (batch: readonly Scan[], bo: BatchOrder): readonly OrderLine[] =>
  batch.flatMap((scan, i) => {
    if (scan.kind !== 'menu') return [];
    const order = bo[scan.id] ?? {};
    return scan.items.flatMap((item) => (order[item.id] ? [{ scanId: scan.id, photo: i + 1, item, qty: order[item.id]! }] : []));
  });

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

const pronOf = (it: MenuItem): string => it.pron || it.tr.replace(/\s*[(（].*?[)）]\s*$/, '');

export type OrderText = { readonly ja: string; readonly pron: string; readonly ko: string };

/**
 * 상황별 앞뒤 인사. 추가 주문 때마다 「注文お願いします … 以上です」를 붙이면 어색해서(사용자 결정 2026-10-21) 셋으로 나눈다.
 * first: 첫 주문 · more: 추가 주문 · plain: 항목만(직원이 이미 와 있을 때)
 */
export type OrderMode = 'first' | 'more' | 'plain';
/** 세그먼트 옵션. 라벨은 호출 시점의 앱 언어로 */
export const orderModes = (): ReadonlyArray<{ readonly value: OrderMode; readonly label: string }> => {
  const m = dict().order.modes;
  return [{ value: 'first', label: m.first }, { value: 'more', label: m.more }, { value: 'plain', label: m.plain }];
};
/** 앞 인사 · 목록 끝 부호 · 뒤 인사. ja/pron/ko 를 키로 맞춰 순서 실수를 타입이 잡게 한다 */
type Frame = { readonly head: OrderText; readonly end: OrderText; readonly tail: OrderText };
const T = (ja: string, pron: string, ko: string): OrderText => ({ ja, pron, ko });
const FRAMES: Readonly<Record<OrderMode, Frame>> = {
  first: { head: T('すみません、注文お願いします。', '스미마셍, 츄-몬 오네가이시마스.', '실례합니다, 주문할게요.'), end: T('。', '.', '.'), tail: T('以上です。', '이죠-데스.', '이상입니다.') },
  more: { head: T('すみません、追加で注文お願いします。', '스미마셍, 츠이카데 츄-몬 오네가이시마스.', '실례합니다, 추가로 주문할게요.'), end: T('。', '.', '.'), tail: T('以上です。', '이죠-데스.', '이상입니다.') },
  // 항목만: 목록을 「、」로 열어 두고 お願いします 로 잇는다 (「ふたつ。 お願いします。」보다 자연스럽다)
  plain: { head: T('', '', ''), end: T('、', ',', ','), tail: T('お願いします。', '오네가이시마스.', '부탁해요.') },
};
const join = (head: string, body: string, tail: string): string => [head, body, tail].filter((t) => t.length > 0).join('\n');

/** 직원에게 보여줄 일본어 · 읽을 수 있는 한글 발음 · 뜻 */
export const buildOrderText = (lines: readonly OrderLine[], mode: OrderMode = 'first'): OrderText => {
  const f = FRAMES[mode];
  const ja = join(f.head.ja, `${lines.map((l) => `${l.item.name} ${countJa(l.qty)}`).join('、\n')}${f.end.ja}`, f.tail.ja);
  const pron = join(f.head.pron, `${lines.map((l) => `${pronOf(l.item)} ${countKo(l.qty)}`).join(',\n')}${f.end.pron}`, f.tail.pron);
  const ko = join(f.head.ko, `${lines.map((l) => `${l.item.tr} ${l.qty}개`).join(',\n')}${f.end.ko}`, f.tail.ko);
  return { ja, pron, ko };
};
