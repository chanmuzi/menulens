/** 「홈 화면에 추가」 안내. 한 줄로 접혀 있고 「방법」을 누르면 두 줄 더 펼친다. 닫으면 다시 보이지 않는다. */
import { useState } from 'react';
import type { InstallHint as Hint } from '../lib/platform';
import { useT } from '../i18n';

type Props = { readonly hint: Hint };

export const InstallHint = ({ hint }: Props) => {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (hint.kind === 'none') return null;
  return (
    <div className="frame frame--flat" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, background: 'var(--paper-dark)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, lineHeight: 1.4 }}>{t.home.install.hint}</span>
        {hint.kind === 'prompt'
          ? <button type="button" className="btn" onClick={() => void hint.install()} style={{ minHeight: 36, padding: '0 10px', fontSize: 13 }}>{t.home.install.add}</button>
          : <button type="button" className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ minHeight: 36, padding: '0 10px', fontSize: 13 }}>{t.home.install.how}</button>}
        <button type="button" className="btn btn--quiet" onClick={hint.dismiss} aria-label={t.home.install.dismissAria} style={{ minHeight: 36, padding: '0 6px' }}>✕</button>
      </div>
      {open && hint.kind === 'ios' && (
        <ol className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>{t.home.install.iosStep1Before}<strong>{t.home.install.iosStep1Strong}</strong>{t.home.install.iosStep1After}</li>
          <li><strong>{t.home.install.iosStep2Strong}</strong>{t.home.install.iosStep2After}</li>
        </ol>
      )}
    </div>
  );
};
