/** 여러 장 묶음의 썸네일 띠. 현재 사진은 주홍 테두리, 상태(읽는 중·완료·실패)를 모서리에 표시. 처리 중·결과 화면 공용 */
import type { Scan } from '../types';

type Props = { readonly scans: readonly Scan[]; readonly currentId: string | null; readonly onSwitch: (id: string) => void };

const statusMark = (s: Scan): { readonly text: string; readonly color: string } => {
  if (s.status === 'error') return { text: '✕', color: 'var(--vermilion)' };
  if (s.status === 'done' || s.status === 'detailing') return { text: '✓', color: 'var(--ink)' };
  return { text: '…', color: 'var(--muted)' };
};

export const BatchStrip = ({ scans, currentId, onSwitch }: Props) => {
  if (scans.length < 2) return null;
  const idx = Math.max(0, scans.findIndex((s) => s.id === currentId));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span className="dot muted" style={{ fontSize: 11, flexShrink: 0 }}>사진 {idx + 1}/{scans.length}</span>
      <div role="group" aria-label="묶음 사진" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '3px 3px 3px 0' }}>
        {scans.map((s, i) => {
          const mark = statusMark(s);
          const active = s.id === currentId;
          return (
            <button key={s.id} type="button" aria-current={active ? 'true' : undefined} aria-label={`사진 ${i + 1} ${s.status === 'error' ? '실패' : s.status === 'done' || s.status === 'detailing' ? '완료' : '읽는 중'}`} onClick={() => onSwitch(s.id)}
              style={{ position: 'relative', width: 48, height: 48, padding: 0, flexShrink: 0, border: `2px solid ${active ? 'var(--vermilion)' : 'var(--ink)'}`, boxShadow: active ? '2px 2px 0 var(--vermilion)' : 'none', background: 'var(--wood)', cursor: 'pointer', overflow: 'hidden' }}>
              {s.imageDataUrl && <img src={s.imageDataUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: s.status === 'error' ? 0.5 : 1 }} />}
              <span className="dot" aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, minWidth: 16, height: 16, padding: '0 3px', background: 'var(--paper-2)', color: mark.color, fontSize: 11, lineHeight: '16px', borderLeft: '2px solid var(--ink)', borderTop: '2px solid var(--ink)' }}>{mark.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
