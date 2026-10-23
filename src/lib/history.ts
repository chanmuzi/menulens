/** 기록 목록용 묶음. 한 번에 읽은 사진(batchId 공유)은 한 줄로 보여주고, 열면 그 묶음 전체가 띠에 오른다. */
import type { Scan } from '../types';
import { KIND_LABEL } from './kind';

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

/** 가장 많이 나온 분류(옛 메뉴판 기록의 제목용) */
const topCategory = (scan: Scan): string | null => {
  const counts = new Map<string, number>();
  for (const it of scan.items) counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

/**
 * 자동 제목(사용자가 고치지 않았을 때의 이름): 1단계가 지은 「이모지 제목」 → 가게명 → 옛 기록 규칙
 * (메뉴판은 「가장 많은 분류 + 메뉴판」, 안내문은 첫 문단 번역)
 */
export const autoGroupTitle = (g: ScanGroup): string => {
  const auto = g.scans.find((s) => s.autoTitle)?.autoTitle;
  if (auto) return auto;
  const shop = g.scans.find((s) => s.shopName)?.shopName;
  if (shop) return shop;
  const first = g.scans[0]!;
  if (first.kind === 'menu') { const top = topCategory(first); return top ? `${top} ${KIND_LABEL.menu}` : KIND_LABEL.menu; }
  return first.notes[0]?.text_ko ?? first.items[0]?.name_ko ?? KIND_LABEL[first.kind];
};

/** 목록·결과 화면 제목: 사용자가 고친 이름이 있으면 그것 */
export const groupTitle = (g: ScanGroup): string => g.scans.find((s) => s.userTitle)?.userTitle ?? autoGroupTitle(g);

/** 목록 부제의 종류(첫 장 기준). 개수는 쓰지 않는다(2026-10-23 피드백), 장수는 썸네일 배지로 */
export const groupKind = (g: ScanGroup): string => KIND_LABEL[g.scans[0]!.kind];

/** 목록 썸네일: 묶음에서 썸네일이 있는 첫 장 */
export const groupThumb = (g: ScanGroup): string | null => g.scans.find((s) => s.thumb)?.thumb ?? null;
