/** 되돌릴 수 없는 동작 전 확인 팝업(기록 지우기 등). 모양은 LeaveDialog 와 같고, 기본 포커스는 안전한 쪽(취소)에 둔다. */
import { useEffect } from 'react';

type Props = {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

export const ConfirmDialog = ({ title, body, confirmLabel, onCancel, onConfirm }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <div className="frame" style={{ position: 'relative', width: '100%', maxWidth: 360, boxShadow: '4px 4px 0 var(--ink)', padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div id="confirm-title" className="dot" style={{ fontSize: 16 }}>{title}</div>
        <p id="confirm-body" style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--body)', overflowWrap: 'anywhere' }}>{body}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={onCancel} autoFocus style={{ flex: 1 }}>취소</button>
          <button type="button" className="btn btn--primary" onClick={onConfirm} style={{ flex: 1 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};
