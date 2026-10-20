/**
 * OCR 단어 목록을 읽기 순서대로 몇 묶음으로 나눈다 (1단계 LLM 병렬 호출용).
 * 묶음 경계는 이상적 분할점 근처에서 세로 간격이 가장 큰 곳(줄 사이)으로 잡아 항목이 둘로 갈리지 않게 한다.
 */
import type { OcrWord } from './ocr.js';

const CHUNK_THRESHOLD = 60;   // 이 수 이하면 나누지 않는다
const TARGET_PER_CHUNK = 40;  // 묶음당 목표 단어 수
const SEARCH_RATIO = 0.25;    // 이상적 분할점 ±25% 범위에서 경계를 찾는다

export const chunkWords = (words: readonly OcrWord[]): OcrWord[][] => {
  if (words.length <= CHUNK_THRESHOLD) return [[...words]];
  const n = Math.min(4, Math.ceil(words.length / TARGET_PER_CHUNK));
  const sorted = [...words].sort((a, b) => a.box[1] - b.box[1] || a.box[0] - b.box[0]);
  const chunks: OcrWord[][] = [];
  let start = 0;
  for (let c = 1; c < n; c++) {
    const ideal = Math.round((words.length * c) / n);
    const lo = Math.max(start + 1, Math.round(ideal - words.length * SEARCH_RATIO / n));
    const hi = Math.min(sorted.length - 1, Math.round(ideal + words.length * SEARCH_RATIO / n));
    let cut = ideal, bestGap = -1;
    for (let i = lo; i <= hi; i++) {
      const gap = sorted[i]!.box[1] - sorted[i - 1]!.box[3];
      if (gap > bestGap) { bestGap = gap; cut = i; }
    }
    chunks.push(sorted.slice(start, cut));
    start = cut;
  }
  chunks.push(sorted.slice(start));
  return chunks.filter((c) => c.length > 0);
};
