/** 여러 장 묶음의 썸네일 띠. 썸네일마다 번호, 현재 사진은 주홍 테두리, 상태(읽는 중·완료·실패)를 모서리에 표시. 띠 끝에 「k/n」. 처리 중·결과 화면 공용.
 *  onAdd 가 있으면 띠 끝에 「더 찍기」 칸을 두어 결과를 보면서 사진을 더 붙일 수 있다(한 장짜리도 띠를 보여 진입점이 되게) */
import { useRef, type ChangeEvent } from 'react';
import type { Scan } from '../types';
import { BATCH_MAX } from '../lib/batch';
import { useT } from '../i18n';

type Props = { readonly scans: readonly Scan[]; readonly currentId: string | null; readonly onSwitch: (id: string) => void; readonly onAdd?: (files: readonly File[]) => void };

const statusMark = (s: Scan): { readonly text: string; readonly color: string } => {
  if (s.status === 'error') return { text: '✕', color: 'var(--vermilion)' };
  if (s.status === 'done' || s.status === 'detailing') return { text: '✓', color: 'var(--ink)' };
  return { text: '…', color: 'var(--muted)' };
};

export const BatchStrip = ({ scans, currentId, onSwitch, onAdd }: Props) => {
  const t = useT();
  const cameraRef = useRef<HTMLInputElement>(null);
  if (scans.length < 2 && !onAdd) return null;
  const idx = Math.max(0, scans.findIndex((s) => s.id === currentId));
  const room = BATCH_MAX - scans.length;
  const add = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).slice(0, Math.max(0, room));
    e.target.value = '';
    if (picked.length > 0) onAdd?.(picked);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div role="group" aria-label={t.confirm.strip.groupAria} style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: 3, margin: -3, minWidth: 0 }}>
        {scans.map((s, i) => {
          const mark = statusMark(s);
          const active = s.id === currentId;
          return (
            <button key={s.id} type="button" aria-current={active ? 'true' : undefined} aria-label={t.confirm.strip.statusAria(i + 1, s.status === 'error' ? t.confirm.strip.failed : s.status === 'done' || s.status === 'detailing' ? t.common.done : t.confirm.batch.reading)} onClick={() => onSwitch(s.id)}
              style={{ position: 'relative', width: 48, height: 48, padding: 0, flexShrink: 0, border: `2px solid ${active ? 'var(--vermilion)' : 'var(--ink)'}`, boxShadow: active ? '2px 2px 0 var(--vermilion)' : 'none', background: 'var(--wood)', cursor: 'pointer', overflow: 'hidden' }}>
              {s.imageDataUrl && <img src={s.imageDataUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: s.status === 'error' ? 0.5 : 1 }} />}
              {scans.length > 1 && <span className="dot" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, minWidth: 16, height: 16, padding: '0 4px', background: active ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper)', fontSize: 10, lineHeight: '16px' }}>{i + 1}</span>}
              <span className="dot" aria-hidden="true" style={{ position: 'absolute', right: 0, bottom: 0, minWidth: 16, height: 16, padding: '0 3px', background: 'var(--paper-2)', color: mark.color, fontSize: 11, lineHeight: '16px', borderLeft: '2px solid var(--ink)', borderTop: '2px solid var(--ink)' }}>{mark.text}</span>
            </button>
          );
        })}
        {onAdd && room > 0 && (
          <>
            <button type="button" aria-label={t.confirm.strip.takeMoreAria} onClick={() => cameraRef.current?.click()} className="dot"
              style={{ width: 48, height: 48, padding: 0, flexShrink: 0, border: '2px dashed var(--ink)', background: 'var(--paper-2)', cursor: 'pointer', fontSize: 10, lineHeight: 1.2, color: 'var(--vermilion)' }}>
              <span style={{ fontSize: 16, display: 'block', lineHeight: 1 }}>+</span>{t.confirm.batch.takeMore}
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={add} className="sr-only" tabIndex={-1} aria-hidden="true" aria-label={t.confirm.batch.cameraMoreAria} />
          </>
        )}
      </div>
      {scans.length > 1 && <span className="dot muted" aria-live="polite" style={{ fontSize: 12, flexShrink: 0, marginLeft: 'auto' }}>{idx + 1}<span style={{ opacity: .6 }}>/{scans.length}</span></span>}
    </div>
  );
};
