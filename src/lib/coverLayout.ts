/**
 * 안내문 덮개 배치 (순수 함수). 문단마다 「덮개로 그릴지 / 번호만 찍을지」와 글자 영역·크기를 정한다.
 *
 * 판정 기준 (2026-10-23 결정, [[overlay-and-photo]]):
 * 1. 글자 영역 = 문단 줄 상자들의 합집합에서 다른 문단의 줄과 겹치는 쪽을 잘라낸 사각형.
 * 2. 번역문을 그 영역에 줄바꿈해 넣는다. 글자 크기 상한은 원문 줄 굵기의 0.8배(제목 26px, 나머지 20px 까지).
 * 3. 화면 기준 MIN_FONT(11px) 이상으로 들어가지 않으면 이웃 줄에 닿지 않는 범위로 가로 +80%·세로 +60% 까지 넓혀 다시 넣는다.
 * 4. 그래도 안 들어가면 번호만 찍고 번역은 사진 아래 목록에서 읽는다.
 *
 * 좌표는 화면 방향 기준(사진이 90·270 돌아가 있으면 호출 쪽에서 x·y 를 바꿔 넘긴다). 단위는 사진 층 px.
 */
export type Rect = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

export type CoverInput = { readonly text: string; readonly lines: readonly Rect[]; readonly title: boolean };
export type CoverPlan =
  | { readonly mode: 'cover'; readonly rect: Rect; readonly size: number; readonly lines: readonly string[] }
  | { readonly mode: 'badge' };

/** 글자 폭 측정: (글, 글자 크기 px) → 폭 px */
export type Measure = (text: string, size: number) => number;

/** 화면 기준 최소 글자 크기(px). 이보다 작으면 번호로 */
export const MIN_FONT = 11;
const MAX_TITLE = 26;
const MAX_BODY = 20;
export const LINE_HEIGHT = 1.18;
/** 글자 영역 좌우 안쪽 여백(px) */
export const PAD_X = 2;
const GROW_W = 0.8;
const GROW_H = 0.6;
const GROW_STEPS = 8;

export const union = (rs: readonly Rect[]): Rect => {
  const x0 = Math.min(...rs.map((r) => r.x)), y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w)), y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** 경계만 닿는 것은 겹침이 아니다 */
export const meets = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5;

/** r 에서 장애물과 겹치는 쪽을 잘라낸다. 네 방향 중 넓이가 가장 큰 쪽을 남기고, 남는 게 없으면 null */
export const carve = (r: Rect, obstacles: readonly Rect[]): Rect | null => {
  let cur = r;
  for (let n = 0; n < 16; n++) {
    const o = obstacles.find((q) => meets(cur, q));
    if (!o) return cur;
    const cands = [
      { ...cur, w: o.x - cur.x },
      { ...cur, x: o.x + o.w, w: cur.x + cur.w - (o.x + o.w) },
      { ...cur, h: o.y - cur.y },
      { ...cur, y: o.y + o.h, h: cur.y + cur.h - (o.y + o.h) },
    ].filter((c) => c.w > 2 && c.h > 2);
    if (cands.length === 0) return null;
    cur = cands.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
  }
  return obstacles.some((q) => meets(cur, q)) ? null : cur;
};

/** 한국어 줄바꿈(keep-all): 띄어쓰기 단위로 넘기고, 한 어절이 폭보다 길 때만 글자 단위로 자른다 */
export const wrap = (text: string, width: number, size: number, measure: Measure): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const pushChars = (word: string) => {
    for (const ch of [...word]) {
      if (line && measure(line + ch, size) > width) { lines.push(line); line = ch; } else line += ch;
    }
  };
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, size) <= width) { line = next; continue; }
    if (line) { lines.push(line); line = ''; }
    if (measure(word, size) <= width) line = word; else pushChars(word);
  }
  if (line) lines.push(line);
  return lines;
};

/** 영역에 들어가는 가장 큰 글자 크기(0.5px 단위). min 미만이면 null */
export const fitText = (text: string, r: Rect, max: number, min: number, measure: Measure): { size: number; lines: string[] } | null => {
  const width = r.w - PAD_X * 2;
  if (width <= 0 || max < min) return null;
  // 0.5px 단위로 내려가되, min 이 그 눈금에 없어도 마지막에 min 은 꼭 시도한다
  const sizes = [...Array.from({ length: Math.max(0, Math.floor((Math.floor(max * 2) / 2 - min) / 0.5) + 1) }, (_, k) => Math.floor(max * 2) / 2 - k * 0.5), min];
  for (const size of sizes) {
    const lines = wrap(text, width, size, measure);
    if (lines.length * size * LINE_HEIGHT <= r.h + 0.5 && lines.every((l) => measure(l, size) <= width + 0.5)) return { size, lines };
  }
  return null;
};

const median = (xs: readonly number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };

const planOne = (b: CoverInput, obstacles: readonly Rect[], s: number, measure: Measure): CoverPlan => {
  if (b.lines.length === 0) return { mode: 'badge' } as const;
  const base = carve(union(b.lines), obstacles) ?? b.lines[0]!;
  const thick = median(b.lines.map((l) => l.h));
  const max = Math.min((b.title ? MAX_TITLE : MAX_BODY) / s, thick * 0.8);
  const min = MIN_FONT / s;
  let r = base;
  let fit = fitText(b.text, r, Math.max(max, min), min, measure);
  // 안 들어가면 이웃 줄에 닿지 않는 범위에서 가로를 먼저, 다음 세로를 조금씩 넓힌다
  for (let step = 0; step < GROW_STEPS && !fit; step++) {
    const dw = (base.w * GROW_W) / GROW_STEPS, dh = (base.h * GROW_H) / GROW_STEPS;
    for (const next of [{ ...r, x: r.x - dw / 2, w: r.w + dw }, { ...r, y: r.y - dh / 2, h: r.h + dh }]) {
      if (!obstacles.some((o) => meets(next, o))) r = next;
    }
    fit = fitText(b.text, r, Math.max(max, min), min, measure);
  }
  return fit ? { mode: 'cover', rect: r, size: fit.size, lines: fit.lines } as const : { mode: 'badge' } as const;
};

/**
 * 문단들의 덮개 배치. scale = 사진 층 1px 이 화면에서 몇 px 인지(확대 전). 글자 크기 기준은 화면 px 이라 층 px 로 나눠 쓴다.
 */
export const planCovers = (blocks: readonly CoverInput[], scale: number, measure: Measure): CoverPlan[] => {
  const s = scale > 0 ? scale : 1;
  const others = (j: number) => blocks.flatMap((b, k) => (k === j ? [] : b.lines));
  // 앞 문단이 넓혀 차지한 글자 영역도 장애물로 넘겨, 넓힌 영역끼리 겹치지 않게 한다
  return blocks.reduce<CoverPlan[]>((plans, b, j) => {
    const placed = plans.flatMap((p) => (p.mode === 'cover' ? [p.rect] : []));
    return [...plans, planOne(b, [...others(j), ...placed], s, measure)];
  }, []);
};
