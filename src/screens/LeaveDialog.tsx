/** 홈으로 나가기 전 확인. 읽는 중인 사진이 있으면 그 호출을 끊을지 묻는다(뒤에서 계속 돌면 OCR·LLM 비용이 든다). */
import { useEffect } from 'react';
import { useT } from '../i18n';

type Props = {
  /** 읽는 중인 사진 수 */
  readonly busy: number;
  /** 목록은 다 왔고 설명만 쓰는 중(이미 저장됨, 설명만 비게 됨) */
  readonly detailingOnly: boolean;
  readonly onStay: () => void;
  readonly onLeave: () => void;
};

export const LeaveDialog = ({ busy, detailingOnly, onStay, onLeave }: Props) => {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onStay(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="leave-title" style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onStay} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <div className="frame" style={{ position: 'relative', width: '100%', maxWidth: 360, boxShadow: '4px 4px 0 var(--ink)', padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div id="leave-title" className="dot" style={{ fontSize: 16 }}>{detailingOnly ? t.confirm.leave.titleDetailing : t.confirm.leave.titleReading(busy)}</div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--body)' }}>
          {detailingOnly ? t.confirm.leave.bodyDetailing : t.confirm.leave.bodyReading}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--primary" onClick={onStay} autoFocus style={{ flex: 1 }}>{t.confirm.leave.stay}</button>
          <button type="button" className="btn" onClick={onLeave} style={{ flex: 1 }}>{t.confirm.leave.leave}</button>
        </div>
      </div>
    </div>
  );
};
