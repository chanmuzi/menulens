import { useState, type FormEvent } from 'react';
import { verifyCode } from '../lib/api';
import { setAccessCode } from '../lib/storage';
import { PixelIcon } from '../components/PixelIcon';
import { useT } from '../i18n';

type Props = { readonly onEnter: () => void };

export const GateScreen = ({ onEnter }: Props) => {
  const t = useT();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true); setError(null);
    try {
      if (await verifyCode(trimmed)) { setAccessCode(trimmed); onEnter(); }
      else setError(t.home.gate.wrongCode);
    } catch { setError(t.home.gate.serverError); }
    finally { setBusy(false); }
  };

  return (
    <div className="app" style={{ justifyContent: 'center', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 64, height: 64, background: 'var(--vermilion)', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PixelIcon icon="camera" size={3} />
        </div>
        <div className="dot" style={{ fontSize: 22 }}>MENULENS</div>
      </div>
      <form onSubmit={submit} className="frame frame--double" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label htmlFor="code" style={{ fontSize: 14, fontWeight: 600 }}>{t.home.gate.codeLabel}</label>
        <input
          id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false}
          placeholder={t.home.gate.codePlaceholder}
          style={{ height: 48, padding: '0 12px', border: '2px solid var(--ink)', background: 'var(--paper)', fontSize: 16 }}
        />
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--vermilion)' }}>{error}</div>}
        <button type="submit" className="btn btn--primary" disabled={busy || !code.trim()}>{busy ? t.home.gate.checking : t.home.gate.enter}</button>
        <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>{t.home.gate.note}</p>
      </form>
    </div>
  );
};
