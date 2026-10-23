/**
 * 사진에서 글자 상자의 배경색·글자색을 뽑는다 (덮개 라벨용).
 * 배경 = 상자 바깥 얇은 띠의 중앙값, 글자 = 상자 안에서 배경과 가장 먼 픽셀들의 평균.
 * 결과 화면이 뜬 뒤 비동기로 돌고 끝나면 바꿔 끼운다.
 * 획만 지운 배경 조각(patchBox, 2026-10-21)은 얼룩져 보인다는 피드백으로 2026-10-22 제거 — 되살리려면 efc14a2 의 patchBox 참고.
 */
import type { Box } from '../types';

export type Rgb = readonly [number, number, number];
/** 배경·글자색. css 문자열과 원시값을 함께 둬 호출 쪽이 투명도를 더할 수 있게 */
export type BoxColors = { readonly bg: string; readonly fg: string; readonly bgRgb: Rgb };

/** 샘플링 캔버스의 긴 변. 화면 폭(≈350px)에 확대까지 감안해도 조각이 뭉개지지 않을 정도 */
const SAMPLE_LONG_EDGE = 1024;

const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const dist2 = (a: Rgb, b: Rgb): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const css = (c: Rgb): string => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;
export const rgba = (c: Rgb, a: number): string => `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;

/** data URL 을 캔버스 컨텍스트로. 긴 변을 줄여 샘플링 비용을 낮춘다 */
export const loadSampler = (dataUrl: string): Promise<CanvasRenderingContext2D | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, SAMPLE_LONG_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      resolve(ctx);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

const pixels = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): Rgb[] => {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(cw, Math.ceil(x + w)), y1 = Math.min(ch, Math.ceil(y + h));
  if (x1 <= x0 || y1 <= y0) return [];
  const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  const out: Rgb[] = [];
  const step = Math.max(1, Math.floor(d.length / 4 / 400)); // 최대 400픽셀만 본다
  for (let i = 0; i < d.length; i += 4 * step) out.push([d[i]!, d[i + 1]!, d[i + 2]!]);
  return out;
};

/** 0~1000 bbox → 캔버스 픽셀 사각형 */
const toPx = (ctx: CanvasRenderingContext2D, box: Box) => {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  return { x: (box[0] / 1000) * cw, y: (box[1] / 1000) * ch, w: ((box[2] - box[0]) / 1000) * cw, h: ((box[3] - box[1]) / 1000) * ch };
};

/** WCAG 상대 휘도와 대비 */
const relLum = (c: Rgb): number => {
  const ch = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2]);
};
const contrast = (a: Rgb, b: Rgb): number => { const la = relLum(a) + 0.05, lb = relLum(b) + 0.05; return la > lb ? la / lb : lb / la; };

const analyze = (ctx: CanvasRenderingContext2D, box: Box): { readonly bg: Rgb; readonly fg: Rgb } => {
  const { x, y, w, h } = toPx(ctx, box);
  const ring = Math.max(2, Math.min(6, h * 0.3));
  const around = [
    ...pixels(ctx, x - ring, y - ring, w + ring * 2, ring), ...pixels(ctx, x - ring, y + h, w + ring * 2, ring),
    ...pixels(ctx, x - ring, y, ring, h), ...pixels(ctx, x + w, y, ring, h),
  ];
  const inside = pixels(ctx, x, y, w, h);
  const bgSrc = around.length >= 8 ? around : inside;
  const bg: Rgb = [median(bgSrc.map((p) => p[0])), median(bgSrc.map((p) => p[1])), median(bgSrc.map((p) => p[2]))];
  // 글자색: 배경과 가장 먼 상위 15% 픽셀의 평균. 차이가 작으면 밝기로 흑/백
  const far = [...inside].sort((a, b) => dist2(b, bg) - dist2(a, bg)).slice(0, Math.max(1, Math.floor(inside.length * 0.15)));
  const fgAvg: Rgb = far.length ? [far.reduce((n, p) => n + p[0], 0) / far.length, far.reduce((n, p) => n + p[1], 0) / far.length, far.reduce((n, p) => n + p[2], 0) / far.length] : bg;
  // 가는 손글씨·흐린 인쇄는 뽑은 색이 배경과 비슷해 읽기 어렵다 → 대비가 4.5:1 미만이면 먹색/종이색으로
  const fg: Rgb = contrast(fgAvg, bg) < 4.5 ? (relLum(bg) > 0.4 ? [30, 25, 20] : [250, 248, 240]) : fgAvg;
  return { bg, fg };
};

/** 0~1000 정규화 bbox 의 배경·글자색 */
export const sampleBox = (ctx: CanvasRenderingContext2D, box: Box): BoxColors => {
  const { bg, fg } = analyze(ctx, box);
  return { bg: css(bg), fg: css(fg), bgRgb: bg };
};
