import type { ReactNode } from 'react';

type Props = { readonly onBack?: () => void; readonly backLabel?: string; readonly center?: ReactNode; readonly right?: ReactNode };

export const TopBar = ({ onBack, backLabel = '뒤로', center, right }: Props) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
    {onBack ? (
      <button type="button" className="btn btn--icon" aria-label={backLabel} onClick={onBack}>◀</button>
    ) : <div style={{ width: 44 }} />}
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{center}</div>
    {right ?? <div style={{ width: 44 }} />}
  </div>
);
