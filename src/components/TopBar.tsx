import type { ReactNode } from 'react';
import { useT } from '../i18n';

type Props = { readonly onBack?: () => void; readonly backLabel?: string; readonly center?: ReactNode; readonly right?: ReactNode };

export const TopBar = ({ onBack, backLabel, center, right }: Props) => {
  const t = useT();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      {onBack ? (
        <button type="button" className="btn btn--icon" aria-label={backLabel ?? t.common.back} onClick={onBack}>◀</button>
      ) : <div style={{ width: 44 }} />}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{center}</div>
      {right ?? <div style={{ width: 44 }} />}
    </div>
  );
};
