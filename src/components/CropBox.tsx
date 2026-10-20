/**
 * 사진 위에 얹는 영역 지정 상자. 네 모서리·네 변 핸들을 끌어 크기를 바꾸고, 안쪽을 끌면 통째로 옮긴다.
 * 포인터 이벤트라 마우스·터치 모두 같은 코드. 좌표는 부모(사진 표시 영역) 기준 0~1.
 */
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { normalizeRect, type CropRect } from '../lib/crop';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

type Props = { readonly rect: CropRect; readonly onChange: (rect: CropRect) => void };

const CURSOR: Record<Handle, CSSProperties['cursor']> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move' };

/** 핸들을 (dx, dy) 만큼 움직였을 때의 새 사각형 */
const applyDrag = (start: CropRect, h: Handle, dx: number, dy: number): CropRect => {
  if (h === 'move') {
    const w = start.x1 - start.x0, hh = start.y1 - start.y0;
    const x0 = Math.max(0, Math.min(1 - w, start.x0 + dx)), y0 = Math.max(0, Math.min(1 - hh, start.y0 + dy));
    return { x0, y0, x1: x0 + w, y1: y0 + hh };
  }
  return normalizeRect({
    x0: h.includes('w') ? start.x0 + dx : start.x0,
    x1: h.includes('e') ? start.x1 + dx : start.x1,
    y0: h.includes('n') ? start.y0 + dy : start.y0,
    y1: h.includes('s') ? start.y1 + dy : start.y1,
  });
};

const HANDLE_PX = 22;

export const CropBox = ({ rect, onChange }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ h: Handle; x: number; y: number; start: CropRect } | null>(null);

  const onDown = (h: Handle) => (e: ReactPointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { h, x: e.clientX, y: e.clientY, start: rect };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current, root = rootRef.current;
    if (!d || !root) return;
    const { width, height } = root.getBoundingClientRect();
    onChange(applyDrag(d.start, d.h, (e.clientX - d.x) / width, (e.clientY - d.y) / height));
  };
  const onUp = () => { drag.current = null; };

  const pct = (n: number) => `${n * 100}%`;
  const handle = (h: Handle, style: CSSProperties) => (
    <div key={h} role="slider" aria-label={`영역 ${h}`} tabIndex={-1} onPointerDown={onDown(h)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      style={{ position: 'absolute', width: HANDLE_PX, height: HANDLE_PX, cursor: CURSOR[h], touchAction: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      <div style={{ width: h.length === 2 ? 12 : 8, height: h.length === 2 ? 12 : 8, background: 'var(--vermilion)', border: '2px solid var(--paper-2)', boxShadow: '0 0 0 1px var(--ink)' }} />
    </div>
  );
  const half = -HANDLE_PX / 2;

  return (
    <div ref={rootRef} aria-label="영역 지정" style={{ position: 'absolute', inset: 0, touchAction: 'none' }}>
      {/* 바깥 어둡게: 네 조각 */}
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: pct(rect.y0), background: 'rgba(42,33,27,.55)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, bottom: 0, right: 0, height: pct(1 - rect.y1), background: 'rgba(42,33,27,.55)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, top: pct(rect.y0), width: pct(rect.x0), height: pct(rect.y1 - rect.y0), background: 'rgba(42,33,27,.55)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: pct(rect.y0), width: pct(1 - rect.x1), height: pct(rect.y1 - rect.y0), background: 'rgba(42,33,27,.55)', pointerEvents: 'none' }} />
      {/* 선택 영역: 안쪽 끌기 */}
      <div onPointerDown={onDown('move')} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: 'absolute', left: pct(rect.x0), top: pct(rect.y0), width: pct(rect.x1 - rect.x0), height: pct(rect.y1 - rect.y0), border: '2px solid var(--vermilion)', boxShadow: '0 0 0 1px var(--paper-2) inset', cursor: 'move', touchAction: 'none', boxSizing: 'border-box' }}>
        {handle('nw', { left: half, top: half })}
        {handle('ne', { right: half, top: half })}
        {handle('sw', { left: half, bottom: half })}
        {handle('se', { right: half, bottom: half })}
        {handle('n', { left: `calc(50% - ${HANDLE_PX / 2}px)`, top: half })}
        {handle('s', { left: `calc(50% - ${HANDLE_PX / 2}px)`, bottom: half })}
        {handle('w', { left: half, top: `calc(50% - ${HANDLE_PX / 2}px)` })}
        {handle('e', { right: half, top: `calc(50% - ${HANDLE_PX / 2}px)` })}
      </div>
    </div>
  );
};
