/**
 * 사진에서 글자 상자의 배경색·글자색을 뽑고, 글자 획만 지운 배경 조각을 만든다 (덮개 라벨용).
 *
 * 배경 = 상자 바깥 얇은 띠의 중앙값, 글자 = 상자 안에서 배경과 가장 먼 픽셀들의 평균.
 * 배경 조각 = 상자 안에서 「글자 획」으로 판정된 픽셀만 상하좌우의 가장 가까운 비(非)획 픽셀로 메우고 살짝 번지게 한다.
 * 획이 아닌 픽셀은 손대지 않아 종이 질감·조명 그라데이션·얼룩이 그대로 이어진다 (단색 상자보다 덜 어색하다).
 * ML 인페인팅(Google Lens 방식)은 기기에서 돌리기엔 무거워, OpenCV inpaint + 획 마스크 팽창 방식을 픽셀 연산으로 흉내 낸 것.
 * 비용: 상자 하나에 수만 픽셀 → 수 ms. 모두 결과 화면이 뜬 뒤 비동기로 돌고 끝나면 바꿔 끼운다.
 */
import type { Box } from '../types';

export type BoxColors = { readonly bg: string; readonly fg: string };
/** 배경 조각: 상자 주변을 조금 넓힌 영역(0~1000 좌표)과 그 자리를 채울 이미지 */
export type BoxPatch = { readonly url: string; readonly box: Box };

type Rgb = readonly [number, number, number];

/** 샘플링 캔버스의 긴 변. 화면 폭(≈350px)에 확대까지 감안해도 조각이 뭉개지지 않을 정도 */
const SAMPLE_LONG_EDGE = 1024;
/** 획 판정에 쓰는 최소 거리(색 공간, 제곱). 노이즈가 획으로 잡히지 않게 */
const MIN_STROKE_DIST2 = 18 * 18;
/** 획 판정 문턱 = 배경↔글자색 거리의 이 비율. 안티앨리어싱된 흐린 가장자리까지 잡히도록 낮게 */
const STROKE_RATIO = 0.08;
/** 획 마스크 팽창 반경(px). 가장자리의 중간색과 JPEG 링잉(8px 블록 잡음)까지 함께 메운다 */
const DILATE = 5;

const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const dist2 = (a: Rgb, b: Rgb): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const css = (c: Rgb): string => `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;

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
  const lum = (c: Rgb) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const fg: Rgb = dist2(fgAvg, bg) < 40 * 40 ? (lum(bg) > 140 ? [30, 25, 20] : [250, 248, 240]) : fgAvg;
  return { bg, fg };
};

/** 0~1000 정규화 bbox 의 배경·글자색 */
export const sampleBox = (ctx: CanvasRenderingContext2D, box: Box): BoxColors => {
  const { bg, fg } = analyze(ctx, box);
  return { bg: css(bg), fg: css(fg) };
};

/**
 * 글자 획만 지운 배경 조각. 상자를 획 굵기만큼 넓혀 잘라낸 뒤
 *   1) 배경색과 충분히 먼 픽셀을 획으로 판정하고 몇 px 팽창(획 가장자리의 중간색·JPEG 잡음까지 포함)
 *   2) 획 픽셀을 상하좌우에서 가장 가까운 비획 픽셀로 거리 가중 보간
 *   3) 획이었던 자리만 5×5 평균으로 번지게 해 이음새를 감춘다
 * 획이 전혀 없거나 영역이 너무 작으면 null (호출 쪽은 단색으로 되돌아간다).
 * acrossPad: 글줄 굵기 방향 여유(굵기 대비 비율). 번역이 두 줄로 접힐 상자는 크게 줘서 접힌 글도 조각 위에 놓이게 한다.
 */
export const patchBox = (ctx: CanvasRenderingContext2D, box: Box, acrossPad = 0.18): BoxPatch | null => {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const { x, y, w, h } = toPx(ctx, box);
  const vertical = h > w * 2;
  const across = vertical ? w : h;
  const pad = Math.max(2, Math.round(Math.min(w, h) * 0.18));
  const padAcross = Math.max(pad, Math.round(across * acrossPad));
  const padX = vertical ? padAcross : pad, padY = vertical ? pad : padAcross;
  const x0 = Math.max(0, Math.floor(x - padX)), y0 = Math.max(0, Math.floor(y - padY));
  const x1 = Math.min(cw, Math.ceil(x + w + padX)), y1 = Math.min(ch, Math.ceil(y + h + padY));
  const W = x1 - x0, H = y1 - y0;
  if (W < 4 || H < 4) return null;
  const { bg, fg } = analyze(ctx, box);
  const contrast = dist2(fg, bg);
  if (contrast < MIN_STROKE_DIST2) return null;
  const thr = Math.max(MIN_STROKE_DIST2, contrast * STROKE_RATIO);

  const img = ctx.getImageData(x0, y0, W, H);
  const d = img.data;
  const n = W * H;
  const raw = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p: Rgb = [d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!];
    raw[i] = dist2(p, bg) > thr ? 1 : 0;
  }
  // 팽창 (가로 → 세로 두 패스, 비용 O(n·DILATE))
  const tmp = new Uint8Array(n);
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const i = yy * W + xx;
    let m = 0;
    for (let dx = -DILATE; dx <= DILATE && !m; dx++) { const nx = xx + dx; if (nx >= 0 && nx < W && raw[yy * W + nx]) m = 1; }
    tmp[i] = m;
  }
  const mask = new Uint8Array(n);
  let strokes = 0;
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const i = yy * W + xx;
    let m = 0;
    for (let dy = -DILATE; dy <= DILATE && !m; dy++) { const ny = yy + dy; if (ny >= 0 && ny < H && tmp[ny * W + xx]) m = 1; }
    mask[i] = m; strokes += m;
  }
  if (strokes === 0) return null;

  // 네 방향에서 가장 가까운 비획 픽셀의 색과 거리 (한 방향 한 패스)
  const out = new Float32Array(n * 3);
  const acc = new Float32Array(n * 3);
  const wsum = new Float32Array(n);
  const scan = (start: number, step: number, count: number, from: number, stride: number, lines: number) => {
    for (let l = 0; l < lines; l++) {
      let lastIdx = -1, dist = 0;
      let i = from + l * stride + start;
      for (let k = 0; k < count; k++, i += step) {
        if (!mask[i]) { lastIdx = i; dist = 0; continue; }
        dist++;
        if (lastIdx < 0) continue;
        const wgt = 1 / dist;
        acc[i * 3] += d[lastIdx * 4]! * wgt; acc[i * 3 + 1] += d[lastIdx * 4 + 1]! * wgt; acc[i * 3 + 2] += d[lastIdx * 4 + 2]! * wgt;
        wsum[i] += wgt;
      }
    }
  };
  scan(0, 1, W, 0, W, H);            // 왼→오 (행)
  scan(W - 1, -1, W, 0, W, H);       // 오→왼 (행)
  scan(0, W, H, 0, 1, W);            // 위→아래 (열)
  scan((H - 1) * W, -W, H, 0, 1, W); // 아래→위 (열)
  for (let i = 0; i < n; i++) {
    if (!mask[i]) { out[i * 3] = d[i * 4]!; out[i * 3 + 1] = d[i * 4 + 1]!; out[i * 3 + 2] = d[i * 4 + 2]!; continue; }
    const ws = wsum[i]!;
    if (ws > 0) { out[i * 3] = acc[i * 3]! / ws; out[i * 3 + 1] = acc[i * 3 + 1]! / ws; out[i * 3 + 2] = acc[i * 3 + 2]! / ws; }
    else { out[i * 3] = bg[0]; out[i * 3 + 1] = bg[1]; out[i * 3 + 2] = bg[2]; }
  }
  // 획 자리만 5×5 평균으로 번지게 (보간 줄무늬·잔여 잡음을 편다)
  for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
    const i = yy * W + xx;
    if (!mask[i]) { d[i * 4] = out[i * 3]!; d[i * 4 + 1] = out[i * 3 + 1]!; d[i * 4 + 2] = out[i * 3 + 2]!; continue; }
    let r = 0, g = 0, b = 0, c = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const ny = yy + dy, nx = xx + dx;
      if (ny < 0 || ny >= H || nx < 0 || nx >= W) continue;
      const j = ny * W + nx;
      r += out[j * 3]!; g += out[j * 3 + 1]!; b += out[j * 3 + 2]!; c++;
    }
    d[i * 4] = r / c; d[i * 4 + 1] = g / c; d[i * 4 + 2] = b / c;
  }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const pc = c.getContext('2d');
  if (!pc) return null;
  pc.putImageData(img, 0, 0);
  return { url: c.toDataURL('image/png'), box: [(x0 / cw) * 1000, (y0 / ch) * 1000, (x1 / cw) * 1000, (y1 / ch) * 1000] };
};
