/** 주문 수량 스테퍼. 0 이면 「+」 하나만, 1 이상이면 「− n +」. 토스 주문서처럼 작고 둥글지 않은 도트풍 버튼. */
type Props = { readonly qty: number; readonly onChange: (qty: number) => void; readonly label: string; readonly size?: 'small' | 'normal' };

export const QtyStepper = ({ qty, onChange, label, size = 'normal' }: Props) => {
  const h = size === 'small' ? 28 : 36;
  const btn = (text: string, onClick: () => void, aria: string, primary = false) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={aria}
      style={{ width: h, height: h, padding: 0, border: '2px solid var(--ink)', background: primary ? 'var(--vermilion)' : 'var(--paper-2)', color: primary ? 'var(--paper-2)' : 'var(--ink)', fontSize: size === 'small' ? 15 : 18, fontWeight: 600, lineHeight: 1, cursor: 'pointer', boxShadow: '2px 2px 0 var(--ink)' }}>
      {text}
    </button>
  );
  if (qty === 0) return <div role="group" aria-label={`${label} 수량`}>{btn('+', () => onChange(1), `${label} 담기`, true)}</div>;
  return (
    <div role="group" aria-label={`${label} 수량`} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {btn('−', () => onChange(qty - 1), `${label} 하나 빼기`)}
      <span className="dot" aria-live="polite" style={{ minWidth: h, textAlign: 'center', fontSize: size === 'small' ? 15 : 17, fontWeight: 600 }}>{qty}</span>
      {btn('+', () => onChange(qty + 1), `${label} 하나 더`, true)}
    </div>
  );
};
