import { useState, type FormEvent } from 'react';
import { verifyCode } from '../lib/api';
import { setAccessCode } from '../lib/storage';
import { PixelIcon } from '../components/PixelIcon';

type Props = { readonly onEnter: () => void };

export const GateScreen = ({ onEnter }: Props) => {
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
      else setError('맞지 않는 코드예요. 다시 확인해 주세요.');
    } catch { setError('서버에 연결하지 못했어요.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="app" style={{ justifyContent: 'center', gap: 28 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 64, height: 64, background: 'var(--vermilion)', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PixelIcon icon="camera" size={3} />
        </div>
        <div className="dot" style={{ fontSize: 22 }}>MENULENS</div>
        <div className="dot muted" style={{ fontSize: 12 }}>めにゅーれんず</div>
      </div>
      <form onSubmit={submit} className="frame frame--double" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label htmlFor="code" style={{ fontSize: 14, fontWeight: 600 }}>초대 코드</label>
        <input
          id="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false}
          placeholder="받은 코드를 입력해 주세요"
          style={{ height: 48, padding: '0 12px', border: '2px solid var(--ink)', background: 'var(--paper)', fontSize: 16 }}
        />
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--vermilion)' }}>{error}</div>}
        <button type="submit" className="btn btn--primary" disabled={busy || !code.trim()}>{busy ? '확인 중…' : '들어가기'}</button>
        <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>초대받은 분만 쓸 수 있어요. 코드는 이 기기에 저장되어 다음부터 묻지 않아요.</p>
      </form>
    </div>
  );
};
