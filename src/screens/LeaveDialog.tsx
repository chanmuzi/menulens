/** 홈으로 나가기 전 확인. 읽는 중인 사진이 있으면 그 호출을 끊을지 묻는다(뒤에서 계속 돌면 OCR·LLM 비용이 든다). */
import { useEffect } from 'react';

type Props = {
  /** 읽는 중인 사진 수 */
  readonly busy: number;
  /** 목록은 다 왔고 설명만 쓰는 중(이미 저장됨, 설명만 비게 됨) */
  readonly detailingOnly: boolean;
  readonly onStay: () => void;
  readonly onLeave: () => void;
};

export const LeaveDialog = ({ busy, detailingOnly, onStay, onLeave }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onStay(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStay]);
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="leave-title" style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onStay} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <div className="frame" style={{ position: 'relative', width: '100%', maxWidth: 360, boxShadow: '4px 4px 0 var(--ink)', padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div id="leave-title" className="dot" style={{ fontSize: 16 }}>{detailingOnly ? '설명을 아직 쓰는 중이에요' : `사진 ${busy}장을 아직 읽는 중이에요`}</div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--body)' }}>
          {detailingOnly ? '지금 나가면 메뉴 설명이 비어 있는 채로 남아요.' : '지금 나가면 읽기를 멈추고, 읽던 사진은 기록에 남지 않아요.'}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn--primary" onClick={onStay} autoFocus style={{ flex: 1 }}>계속 읽기</button>
          <button type="button" className="btn" onClick={onLeave} style={{ flex: 1 }}>중단하고 홈으로</button>
        </div>
      </div>
    </div>
  );
};
