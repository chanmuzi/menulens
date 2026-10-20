/**
 * 사진에서 글자 상자 주변의 배경색과 글자색을 뽑는다 (파파고식 덮어쓰기용).
 * 배경 = 상자 바깥 얇은 띠의 중앙값, 글자 = 상자 안에서 배경과 가장 먼 픽셀들의 평균.
 */
import type { Box } from '../types';

export type BoxColors = { readonly bg: string; readonly fg: string };

type Rgb = readonly [number, number, number];

const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const dist2 = (a: Rgb, b: Rgb): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const css = (c: Rgb): string => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;

/** data URL 을 캔버스 컨텍스트로. 긴 변 640 으로 줄여 샘플링 비용을 낮춘다 */
export const loadSampler = (dataUrl: string): Promise<CanvasRenderingContext2D | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
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

/** 0~1000 정규화 bbox 의 배경·글자색 */
export const sampleBox = (ctx: CanvasRenderingContext2D, box: Box): BoxColors => {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const x = (box[0] / 1000) * cw, y = (box[1] / 1000) * ch, w = ((box[2] - box[0]) / 1000) * cw, h = ((box[3] - box[1]) / 1000) * ch;
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
  const lum = (c: Rgb) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const fg: Rgb = dist2(fgAvg, bg) < 40 * 40 ? (lum(bg) > 140 ? [30, 25, 20] : [250, 248, 240]) : fgAvg;
  return { bg: css(bg), fg: css(fg) };
};
