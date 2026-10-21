/** 기록 목록용 묶음. 한 번에 읽은 사진(batchId 공유)은 한 줄로 보여주고, 열면 그 묶음 전체가 띠에 오른다. */
import type { Scan } from '../types';
import { KIND_LABEL, lineSummary } from './kind';

export type ScanGroup = {
  /** batchId 또는 한 장짜리의 scan id */
  readonly key: string;
  /** 찍은 순서(createdAt 오름차순) */
  readonly scans: readonly Scan[];
  /** 목록 정렬·시각 표기 기준: 묶음에서 가장 최근 */
  readonly at: number;
};

/** 최신순 스캔 목록을 묶음 단위로. 순서는 각 묶음의 최신 스캔 기준(입력이 최신순이므로 첫 등장 순) */
export const groupScans = (scans: readonly Scan[]): readonly ScanGroup[] => {
  const order: string[] = [];
  const byKey = new Map<string, Scan[]>();
  for (const s of scans) {
    const key = s.batchId ?? s.id;
    const list = byKey.get(key);
    if (list) list.push(s); else { byKey.set(key, [s]); order.push(key); }
  }
  return order.map((key) => {
    const list = [...byKey.get(key)!].sort((a, b) => a.createdAt - b.createdAt);
    return { key, scans: list, at: Math.max(...list.map((s) => s.createdAt)) };
  });
};

/** 목록 제목: 가게명이 있는 스캔을 우선, 없으면 첫 메뉴·첫 줄 */
export const groupTitle = (g: ScanGroup): string => {
  const shop = g.scans.find((s) => s.shopName)?.shopName;
  if (shop) return shop;
  const first = g.scans[0]!;
  return first.kind === 'menu' ? (first.items[0]?.name_ja ?? KIND_LABEL.menu) : (first.notes[0]?.text_ko ?? first.items[0]?.name_ko ?? KIND_LABEL[first.kind]);
};

/** 목록 부제: 「사진 N장 · 12개 메뉴」. 종류는 첫 장 기준이고 그 종류의 스캔만 센다(섞인 묶음에서 안내문 줄을 메뉴로 세지 않게) */
export const groupSummary = (g: ScanGroup): string => {
  const first = g.scans[0]!;
  const same = g.scans.filter((s) => s.kind === first.kind);
  const photos = g.scans.length > 1 ? `사진 ${g.scans.length}장 · ` : '';
  if (first.kind === 'menu') return `${photos}${same.reduce((n, s) => n + s.items.length, 0)}개 메뉴`;
  return `${photos}${lineSummary(first.kind, same.reduce((n, s) => n + (s.notes.length || s.items.length), 0))}`;
};
