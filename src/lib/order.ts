/** 주문 수량과 주문 문구. 메뉴판(kind=menu)에서만 쓴다. 수량은 사진(스캔)별로 localStorage 에 두고(작은 값), 화면에서는 묶음 전체를 합쳐 하나의 주문서로 본다. */
import type { Currency, MenuItem, Scan, ScanLang } from '../types';
import { payable } from './money';
import { dict } from '../i18n';
import { oneOrderText, orderText, type OrderMode, type OrderText } from './orderText';
export type { OrderMode, OrderText } from './orderText';

/** 사진 한 장의 수량: 항목 id → 수량. 항목 id(「묶음:순번」)는 사진마다 겹치므로 사진 밖에서는 BatchOrder 로 다룬다 */
export type Order = Readonly<Record<string, number>>;
/** 묶음 전체의 수량: 사진(스캔) id → Order. 1번 사진에서 담은 것과 2번 사진에서 담은 것이 한 주문서가 된다 */
export type BatchOrder = Readonly<Record<string, Order>>;
/** 주문서 한 줄. photo 는 묶음 안 사진 번호(1부터, 띠의 번호와 같다). lang 은 사진의 방향(원문·앱 언어): 주문 문구의 언어와 발음 표기를 정한다 */
export type OrderLine = { readonly scanId: string; readonly photo: number; readonly item: MenuItem; readonly qty: number; readonly currency: Currency; readonly lang: ScanLang };

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

type ScanHead = Pick<Scan, 'kind' | 'lang'>;
/** 묶음의 주문 기준이 되는 사진(첫 메뉴판). 주문서는 이 사진과 원문 언어가 같은 메뉴판만 모은다 */
const leadScan = (batch: readonly ScanHead[]): ScanHead | undefined => batch.find((s) => s.kind === 'menu');
/**
 * 주문할 수 있는 사진: 메뉴판이고 묶음의 첫 메뉴판과 원문 언어가 같을 때. 원문 언어는 사진마다 판정되므로
 * (한국어 메뉴판 + 일본어 번역 페이지처럼) 한 묶음에 언어·통화가 섞일 수 있는데, 주문 문구는 한 언어로만 만들고 합계도 한 통화여야 한다. 화면과 주문서가 같은 기준을 쓴다
 */
export const canOrderScan = (scan: ScanHead, batch: readonly ScanHead[]): boolean => scan.kind === 'menu' && scan.lang.src === (leadScan(batch) ?? scan).lang.src;

/** 묶음 전체의 주문서 줄: 사진 순서대로, 사진 안에서는 메뉴 순서대로. 주문할 수 없는 사진은 건너뛴다 */
export const batchLines = (batch: readonly Scan[], bo: BatchOrder): readonly OrderLine[] =>
  batch.flatMap((scan, i) => {
    if (!canOrderScan(scan, batch)) return [];
    const order = bo[scan.id] ?? {};
    return scan.items.flatMap((item) => (order[item.id] ? [{ scanId: scan.id, photo: i + 1, item, qty: order[item.id]!, currency: scan.currency, lang: scan.lang }] : []));
  });

export const totalCount = (lines: readonly OrderLine[]): number => lines.reduce((n, l) => n + l.qty, 0);
/** 가격 미표기 항목은 합계에서 뺀다. 그런 항목이 있으면 두 번째 값이 true */
export const total = (lines: readonly OrderLine[]): readonly [number, boolean] => [
  lines.reduce((n, l) => n + (payable(l.item) ?? 0) * l.qty, 0),
  lines.some((l) => payable(l.item) === null),
];
/** 주문서의 통화: 묶음은 같은 나라 사진이므로 첫 줄의 것. 비어 있으면 엔화 */
export const linesCurrency = (lines: readonly OrderLine[]): Currency => lines[0]?.currency ?? 'JPY';
/** 주문서의 방향: 첫 줄의 것. 비어 있으면 일→한 */
export const linesLang = (lines: readonly OrderLine[]): ScanLang => lines[0]?.lang ?? { src: 'ja', dst: 'ko' };

/** 세그먼트 옵션. 라벨은 호출 시점의 앱 언어로 */
export const orderModes = (): ReadonlyArray<{ readonly value: OrderMode; readonly label: string }> => {
  const m = dict().order.modes;
  return [{ value: 'first', label: m.first }, { value: 'more', label: m.more }, { value: 'plain', label: m.plain }];
};

/** 직원에게 보여줄 원문 · 발음 · 뜻. 뜻 줄은 사진의 번역 언어(lang.dst) 사전으로(이름 tr 이 그 언어라, 앱 언어를 바꾼 뒤 연 기록도 섞이지 않는다) */
export const buildOrderText = (lines: readonly OrderLine[], mode: OrderMode = 'first'): OrderText => {
  const lang = linesLang(lines);
  return orderText(dict(lang.dst).order, lines, mode, lang);
};
/** 상세 시트의 「하나 주세요」 문구 */
export const buildOneOrderText = (item: MenuItem, lang: ScanLang): OrderText => oneOrderText(dict(lang.dst).order, item, lang);
