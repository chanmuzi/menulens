import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Quad } from '../types';

type Props = {
  readonly src: string;
  readonly width: number;
  readonly height: number;
  readonly quad: Quad | null;
  readonly maxHeight: number;
  readonly dim?: boolean;
  /** 사진과 함께 회전·확대되는 레이어 (bbox 기준 마커). 좌표는 % 로 둔다. */
  readonly children?: ReactNode;
  /** 사진 위에 고정되는 레이어 (스캔 라인, 코너 등) */
  readonly overlay?: ReactNode;
};

type Fit = { readonly boxH: number; readonly transform: string; readonly angle: number; readonly scale: number };

const MAX_ANGLE = 15;
/** 메뉴판이 사진의 이 비율(가로·세로 각각) 이상을 차지할 때만 모서리를 신뢰한다 */
const MIN_QUAD_SPAN = 0.45;

/** 모서리가 그럴듯한 사각형인지 (순서가 뒤섞였거나 너무 작으면 보정하지 않는다) */
const isTrustworthy = (q: Quad): boolean => {
  const [tl, tr, br, bl] = q;
  const w = Math.min(tr[0] - tl[0], br[0] - bl[0]);
  const h = Math.min(bl[1] - tl[1], br[1] - tr[1]);
  return w > MIN_QUAD_SPAN * 1000 && h > MIN_QUAD_SPAN * 1000;
};

/**
 * 메뉴판 네 모서리(quad)가 있으면 윗변 기울기만큼 되돌려 세우고, 메뉴판 영역이 꽉 차도록 확대·중앙 정렬한다.
 * 원근 왜곡까지 펴지는 않는다 (CSS 2D 변환). quad 가 없으면 사진 전체를 가운데 맞춤.
 */
const computeFit = (W: number, imgW: number, imgH: number, quad: Quad | null, maxH: number): Fit => {
  const Hi = (W * imgH) / imgW;                     // 사진을 가로 W 로 놓았을 때 높이
  const toPx = (p: readonly [number, number]) => [(p[0] / 1000) * W, (p[1] / 1000) * Hi] as const;
  const c = [W / 2, Hi / 2] as const;
  let angle = 0;
  let pts: ReadonlyArray<readonly [number, number]> = [[0, 0], [W, 0], [W, Hi], [0, Hi]];
  const usable = quad !== null && isTrustworthy(quad);
  if (quad && usable) {
    const q = quad.map(toPx);
    const a = (Math.atan2(q[1]![1] - q[0]![1], q[1]![0] - q[0]![0]) * 180) / Math.PI;
    angle = Math.abs(a) <= MAX_ANGLE ? a : 0;
    pts = q;
  }
  const rad = (-angle * Math.PI) / 180;
  const rot = pts.map(([x, y]) => {
    const dx = x - c[0], dy = y - c[1];
    return [c[0] + dx * Math.cos(rad) - dy * Math.sin(rad), c[1] + dx * Math.sin(rad) + dy * Math.cos(rad)] as const;
  });
  const pad = usable ? 0.03 : 0;
  const minX = Math.min(...rot.map((p) => p[0])), maxX = Math.max(...rot.map((p) => p[0]));
  const minY = Math.min(...rot.map((p) => p[1])), maxY = Math.max(...rot.map((p) => p[1]));
  const cw = (maxX - minX) * (1 + pad * 2), ch = (maxY - minY) * (1 + pad * 2);
  const boxH = Math.min(maxH, (W * ch) / cw);
  const scale = Math.min(W / cw, boxH / ch);
  const cc = [(minX + maxX) / 2, (minY + maxY) / 2] as const;
  const dx = W / 2 - c[0] - scale * (cc[0] - c[0]);
  const dy = boxH / 2 - c[1] - scale * (cc[1] - c[1]);
  return { boxH, angle, scale, transform: `translate(${dx}px, ${dy}px) rotate(${-angle}deg) scale(${scale})` };
};

export const MenuPhoto = ({ src, width, height, quad, maxHeight, dim = false, children, overlay }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    setW(el.clientWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const fit = W > 0 ? computeFit(W, width, height, quad, maxHeight) : null;
  const Hi = W > 0 ? (W * height) / width : 0;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: fit?.boxH ?? maxHeight, overflow: 'hidden', background: 'var(--wood)' }}>
      {fit && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: Hi, transformOrigin: `${W / 2}px ${Hi / 2}px`, transform: fit.transform }}>
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'fill', opacity: dim ? 0.5 : 1 }} />
          {children}
        </div>
      )}
      {overlay}
    </div>
  );
};

/** children 안에서 마커를 세워 두고 싶을 때 쓰는 역변환 */
export const counterTransform = (angle: number, scale: number): string => `rotate(${angle}deg) scale(${1 / scale})`;

export { computeFit };
