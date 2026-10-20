/** 주문 수량 스테퍼. 항상 「− n +」 고정 폭(0 이면 − 비활성)이라 카드 글자 영역이 흔들리지 않는다. */
type Props = { readonly qty: number; readonly onChange: (qty: number) => void; readonly label: string; readonly size?: 'small' | 'normal' };

export const QtyStepper = ({ qty, onChange, label, size = 'normal' }: Props) => {
  const h = size === 'small' ? 26 : 36;
  const btn = (text: string, onClick: () => void, aria: string, primary = false, disabled = false) => (
    <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={aria}
      style={{ width: h, height: h, padding: 0, border: '2px solid var(--ink)', background: primary ? 'var(--vermilion)' : 'var(--paper-2)', color: primary ? 'var(--paper-2)' : 'var(--ink)', fontSize: size === 'small' ? 14 : 18, fontWeight: 600, lineHeight: 1, cursor: disabled ? 'default' : 'pointer', boxShadow: disabled ? 'none' : '2px 2px 0 var(--ink)', opacity: disabled ? 0.4 : 1 }}>
      {text}
    </button>
  );
  // 항상 「− n +」 세 칸을 그려 폭이 변하지 않게 한다 (0 이면 − 비활성)
  return (
    <div role="group" aria-label={`${label} 수량`} style={{ display: 'flex', alignItems: 'center', width: h * 3 + 4, flexShrink: 0 }}>
      {btn('−', () => onChange(qty - 1), `${label} 하나 빼기`, false, qty === 0)}
      <span className="dot" aria-live="polite" style={{ width: h, textAlign: 'center', fontSize: size === 'small' ? 14 : 17, fontWeight: 600 }}>{qty}</span>
      {btn('+', () => onChange(qty + 1), qty === 0 ? `${label} 담기` : `${label} 하나 더`, true)}
    </div>
  );
};
