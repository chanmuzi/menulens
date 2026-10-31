import { useLayoutEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import type { Box, OcrWord } from '../types';
import { useT } from '../i18n';

export type Fit = { readonly boxH: number; readonly transform: string; readonly angle: number; readonly scale: number };
/** 마커 레이어에 넘겨주는 값. markerScale 을 마커 transform 에 곱하면 화면상 크기가 일정해진다 */
export type MarkerCtx = { readonly fit: Fit; readonly zoom: number; readonly markerScale: number; readonly W: number; readonly Hi: number };

type Props = {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  /** OCR 단어들. 글자 영역으로 확대·중앙 정렬하는 기준 */
  readonly words: readonly OcrWord[];
  /** 글자가 시계 방향으로 돌아간 각도. 이만큼 되돌려 세운다 */
  readonly rotation?: 0 | 90 | 180 | 270;
  /** 미세 기울기(도). 이만큼 되돌려 글줄을 수평으로 */
  readonly tilt?: number;
  readonly maxHeight: number;
  readonly dim?: boolean;
  /** 두 손가락 확대·끌기 허용 (사진 안에서만 확대되고 페이지는 그대로) */
  readonly zoomable?: boolean;
  /** 사진과 함께 회전·확대되는 레이어 (bbox 기준 마커). 좌표는 % 로 둔다. */
  readonly children?: ReactNode | ((ctx: MarkerCtx) => ReactNode);
  /** 사진 위에 고정되는 레이어 (스캔 라인, 코너 등) */
  readonly overlay?: ReactNode;
};

const MAX_TILT = 15;
/** 글자 영역 주변 여백 (영역 크기 대비) */
const FOCUS_PAD = 0.08;
/** 단어가 이보다 적으면 글자 영역 확대를 하지 않는다 */
const MIN_WORDS_FOR_FOCUS = 3;
const MAX_ZOOM = 4;

/** 단어 상자 합집합 + 여백. 0~1000 좌표 */
export const focusBox = (words: readonly OcrWord[]): Box | null => {
  if (words.length < MIN_WORDS_FOR_FOCUS) return null;
  const x0 = Math.min(...words.map((w) => w.box[0])), y0 = Math.min(...words.map((w) => w.box[1]));
  const x1 = Math.max(...words.map((w) => w.box[2])), y1 = Math.max(...words.map((w) => w.box[3]));
  const px = (x1 - x0) * FOCUS_PAD, py = (y1 - y0) * FOCUS_PAD;
  return [Math.max(0, x0 - px), Math.max(0, y0 - py), Math.min(1000, x1 + px), Math.min(1000, y1 + py)];
};

/**
 * 사진을 가로 W 로 놓고, 글자 방향(rotation)과 미세 기울기(tilt)를 되돌린 뒤,
 * 글자 영역(focus)이 상자에 꽉 차도록 확대·중앙 정렬하는 CSS transform 을 계산한다. 원근 왜곡은 펴지 않는다.
 */
export const computeFit = (W: number, imgW: number, imgH: number, focus: Box | null, maxH: number, rotation = 0, tilt = 0): Fit => {
  const Hi = (W * imgH) / imgW;
  const c = [W / 2, Hi / 2] as const;
  const toPx = (x: number, y: number) => [(x / 1000) * W, (y / 1000) * Hi] as const;
  const pts: ReadonlyArray<readonly [number, number]> = focus
    ? [toPx(focus[0], focus[1]), toPx(focus[2], focus[1]), toPx(focus[2], focus[3]), toPx(focus[0], focus[3])]
    : [[0, 0], [W, 0], [W, Hi], [0, Hi]];
  const angle = rotation + (Math.abs(tilt) <= MAX_TILT ? tilt : 0);
  const rad = (-angle * Math.PI) / 180;
  const rot = pts.map(([x, y]) => {
    const dx = x - c[0], dy = y - c[1];
    return [c[0] + dx * Math.cos(rad) - dy * Math.sin(rad), c[1] + dx * Math.sin(rad) + dy * Math.cos(rad)] as const;
  });
  const minX = Math.min(...rot.map((p) => p[0])), maxX = Math.max(...rot.map((p) => p[0]));
  const minY = Math.min(...rot.map((p) => p[1])), maxY = Math.max(...rot.map((p) => p[1]));
  const cw = Math.max(1, maxX - minX), ch = Math.max(1, maxY - minY);
  const boxH = Math.max(120, Math.min(maxH, (W * ch) / cw));
  const scale = Math.min(W / cw, boxH / ch);
  const cc = [(minX + maxX) / 2, (minY + maxY) / 2] as const;
  const dx = W / 2 - c[0] - scale * (cc[0] - c[0]);
  const dy = boxH / 2 - c[1] - scale * (cc[1] - c[1]);
  return { boxH, angle, scale, transform: `translate(${dx}px, ${dy}px) rotate(${-angle}deg) scale(${scale})` };
};

type Zoom = { z: number; tx: number; ty: number };
const dist = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

export const MenuPhoto = ({ src, width, height, words, rotation = 0, tilt = 0, maxHeight, dim = false, zoomable = false, children, overlay }: Props) => {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const [zoom, setZoom] = useState<Zoom>({ z: 1, tx: 0, ty: 0 });
  const gesture = useRef<{ startDist: number; startZoom: Zoom; mid: [number, number]; last: [number, number] | null; lastTap: number }>({ startDist: 0, startZoom: { z: 1, tx: 0, ty: 0 }, mid: [0, 0], last: null, lastTap: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = W > 0 ? computeFit(W, width, height, focusBox(words), maxHeight, rotation, tilt) : null;
  const Hi = W > 0 ? (W * height) / width : 0;

  /** 확대 후에도 사진이 상자 밖으로 완전히 나가지 않도록 이동량을 제한 */
  const clampZoom = (q: Zoom): Zoom => {
    if (!fit) return q;
    const z = Math.min(MAX_ZOOM, Math.max(1, q.z));
    const maxTx = (z - 1) * W, maxTy = (z - 1) * fit.boxH;
    return { z, tx: Math.min(0, Math.max(-maxTx, q.tx)), ty: Math.min(0, Math.max(-maxTy, q.ty)) };
  };

  const onTouchStart = (e: TouchEvent) => {
    if (!zoomable) return;
    const g = gesture.current;
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      g.startDist = dist(a, b);
      g.startZoom = zoom;
      const rect = ref.current!.getBoundingClientRect();
      g.mid = [(a.clientX + b.clientX) / 2 - rect.left, (a.clientY + b.clientY) / 2 - rect.top];
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - g.lastTap < 300) setZoom({ z: 1, tx: 0, ty: 0 }); // 두 번 탭: 원래 크기
      g.lastTap = now;
      g.last = zoom.z > 1 ? [e.touches[0]!.clientX, e.touches[0]!.clientY] : null;
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    if (!zoomable) return;
    const g = gesture.current;
    if (e.touches.length === 2 && g.startDist > 0) {
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      const ratio = dist(a, b) / g.startDist;
      const z = g.startZoom.z * ratio;
      // 두 손가락 중점이 제자리에 남도록 이동량 보정
      const [mx, my] = g.mid;
      const k = z / g.startZoom.z;
      setZoom(clampZoom({ z, tx: mx - k * (mx - g.startZoom.tx), ty: my - k * (my - g.startZoom.ty) }));
    } else if (e.touches.length === 1 && g.last && zoom.z > 1) {
      const t = e.touches[0]!;
      const [lx, ly] = g.last;
      g.last = [t.clientX, t.clientY];
      setZoom((q) => clampZoom({ ...q, tx: q.tx + (t.clientX - lx), ty: q.ty + (t.clientY - ly) }));
    }
  };
  const onTouchEnd = (e: TouchEvent) => {
    const g = gesture.current;
    if (e.touches.length < 2) g.startDist = 0;
    if (e.touches.length === 0) g.last = null;
  };

  const ctx: MarkerCtx | null = fit ? { fit, zoom: zoom.z, markerScale: 1 / (fit.scale * zoom.z), W, Hi } : null;
  const content = typeof children === 'function' ? (ctx ? children(ctx) : null) : children;

  return (
    <div ref={ref} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}
      style={{ position: 'relative', width: '100%', height: fit?.boxH ?? maxHeight, overflow: 'hidden', background: 'var(--wood)',
        // 확대 전: 한 손가락은 페이지 스크롤로 통과(pan-y), 두 손가락만 받는다. 확대 후: 한 손가락이 사진을 끈다.
        touchAction: zoomable ? (zoom.z > 1 ? 'none' : 'pan-y') : 'auto' }}>
      {zoomable && zoom.z > 1 && (
        <button type="button" onClick={() => setZoom({ z: 1, tx: 0, ty: 0 })}
          style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 6, height: 32, padding: '0 10px', background: 'var(--paper-2)', color: 'var(--ink)', border: '2px solid var(--ink)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {t.result.resetZoom(zoom.z.toFixed(1))}
        </button>
      )}
      {fit && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: fit.boxH, transformOrigin: '0 0', transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.z})` }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: Hi, transformOrigin: `${W / 2}px ${Hi / 2}px`, transform: fit.transform, willChange: 'transform' }}>
            <img src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'fill', opacity: dim ? 0.5 : 1 }} />
            {content}
          </div>
        </div>
      )}
      {overlay}
    </div>
  );
};
