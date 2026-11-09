/** 나가기(홈 또는 전체 보기로) 전 확인. 읽는 중인 사진이 있으면 그 호출을 끊을지 묻는다(뒤에서 계속 돌면 OCR·LLM 비용이 든다). */
import { useT } from '../i18n';
import { useBackLayer } from '../lib/backNav';

type Props = {
  /** 읽는 중인 사진 수 */
  readonly busy: number;
  /** 목록은 다 왔고 설명만 쓰는 중(이미 저장됨, 설명만 비게 됨) */
  readonly detailingOnly: boolean;
  readonly onStay: () => void;
  readonly onLeave: () => void;
  /** 나가기 버튼 이름(「중단하고 홈으로」·「중단하고 목록으로」) */
  readonly leaveLabel: string;
};

export const LeaveDialog = ({ busy, detailingOnly, onStay, onLeave, leaveLabel }: Props) => {
  const t = useT();
  // 시스템 뒤로 가기(안드로이드 뒤로 버튼, Safari 스와이프)와 Escape 는 화면을 옮기기 전에 이것부터 닫는다
  useBackLayer(true, onStay);
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
          <button type="button" className="btn" onClick={onLeave} style={{ flex: 1 }}>{leaveLabel}</button>
        </div>
      </div>
    </div>
  );
};
