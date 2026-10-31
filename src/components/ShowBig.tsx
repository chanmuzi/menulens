/** 상대에게 크게 보여주기: 화면 가득 일본어(또는 영어) + 히라가나, 아래에 내가 소리 내 읽을 한글 발음 */
import { useEffect } from 'react';
import { useT } from '../i18n';

type Props = {
  readonly text: string;
  readonly lang: 'ja' | 'en';
  readonly kana: string;
  readonly pron: string;
  readonly onClose: () => void;
};

export const ShowBig = ({ text, lang, kana, pron, onClose }: Props) => {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={t.talk.showBigTitle} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', padding: 'calc(12px + max(var(--safe-top) + 8px, var(--edge-top))) 20px calc(20px + var(--safe-bottom))' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={onClose} autoFocus style={{ minWidth: 72 }}>{t.common.close}</button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, overflowY: 'auto' }}>
        <p lang={lang} style={{ margin: 0, fontFamily: lang === 'ja' ? 'var(--font-jp)' : 'var(--font-ui)', fontWeight: 700, fontSize: text.length > 40 ? 28 : 34, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{text}</p>
        {kana && <p lang="ja" style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--muted)' }}>{kana}</p>}
      </div>
      {pron && (
        <div style={{ borderTop: '2px solid var(--ink)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="muted small">{t.talk.myPron}</span>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: 'var(--vermilion-dark)' }}>{pron}</p>
        </div>
      )}
    </div>
  );
};
