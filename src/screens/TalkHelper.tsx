/**
 * 도우미 시트: 대화 중 상대에게 묻기 애매한 걸 따로 묻는다(상대에게는 보이지 않음). 지금까지의 대화를 맥락으로 보낸다.
 * 답 끝 「말해 볼 문장」은 카드로 떼어 「대화에 넣고 보여주기」로 내 말풍선에 넣는다. 모양은 결과 화면 챗(ChatPopup)과 같다.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { HelperMsg, TalkTurn } from '../types';
import { askHelper } from '../lib/talkApi';
import { contextTurns, splitSay } from '../lib/talk';
import { DotGlyph } from '../components/DotGlyph';
import { useT } from '../i18n';

type Props = {
  readonly turns: readonly TalkTurn[];
  readonly msgs: readonly HelperMsg[];
  readonly onMsgs: (msgs: readonly HelperMsg[]) => void;
  /** 「말해 볼 문장」을 대화에 넣는다 */
  readonly onSay: (ja: string, pron: string) => void;
  readonly onClose: () => void;
};

const bubble = (mine: boolean) => ({
  alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '92%', padding: '8px 10px', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const,
  background: mine ? 'var(--ink)' : 'var(--paper)', color: mine ? 'var(--paper)' : 'var(--ink)', border: '2px solid var(--ink)', boxShadow: mine ? 'none' : '2px 2px 0 var(--ink)',
});

export const TalkHelper = ({ turns, msgs, onMsgs, onSay, onClose }: Props) => {
  const t = useT();
  const [draft, setDraft] = useState('');
  const [live, setLive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ac = useRef<AbortController | null>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs, live]);
  useEffect(() => () => ac.current?.abort(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || live !== null) return;
    setError(null);
    setDraft('');
    const asked = [...msgs, { role: 'me' as const, text: question, at: Date.now() }];
    onMsgs(asked);
    ac.current?.abort();
    const ctrl = new AbortController();
    ac.current = ctrl;
    setLive('');
    try {
      const text = await askHelper(question, contextTurns(turns), msgs.map((m) => ({ role: m.role, text: m.text })), setLive, ctrl.signal);
      onMsgs([...asked, { role: 'bot', text, at: Date.now() }]);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (ac.current === ctrl) setLive(null);
    }
  };
  // 보내면 키보드를 내려 답을 가리지 않게 한다(결과 화면 챗과 같다)
  const submit = (e: FormEvent) => { e.preventDefault(); inputRef.current?.blur(); void ask(draft); };

  return (
    <div role="dialog" aria-modal="true" aria-label={t.talk.helperTitle} style={{ position: 'fixed', inset: 0, zIndex: 35, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.35)', border: 0, cursor: 'pointer' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '76dvh', background: 'var(--paper-2)', borderTop: '3px solid var(--ink)', display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 14px calc(12px + var(--safe-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DotGlyph name="sparkle" size={16} />
          <span className="dot" style={{ fontSize: 15 }}>{t.talk.helperTitle}</span>
          <span className="muted small">{t.talk.helperHidden}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn--quiet" onClick={onClose} aria-label={t.common.close} style={{ minHeight: 36, minWidth: 36, padding: '0 8px', fontSize: 16, color: 'var(--ink)' }}>✕</button>
        </div>
        <div className="sr-only" role="status">{msgs.length > 0 && msgs[msgs.length - 1]!.role === 'bot' ? msgs[msgs.length - 1]!.text : ''}</div>
        <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs.length === 0 && live === null && (
            <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>{t.talk.helperIntro}</p>
          )}
          {msgs.map((m, i) => {
            if (m.role === 'me') return <div key={`${m.at}-${i}`} style={bubble(true)}>{m.text}</div>;
            const { body, say } = splitSay(m.text);
            return (
              <div key={`${m.at}-${i}`} style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ ...bubble(false), maxWidth: '100%' }}>{body}</div>
                {say && (
                  <div style={{ border: '2px solid var(--vermilion)', background: 'var(--paper-2)', padding: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--vermilion)' }}>{t.talk.sayLabel}</span>
                    <span lang="ja" className="jp" style={{ fontSize: 18, lineHeight: 1.45 }}>{say.ja}</span>
                    <span style={{ fontSize: 12, color: 'var(--vermilion-dark)' }}>{say.pron}</span>
                    <button type="button" className="btn btn--primary" onClick={() => onSay(say.ja, say.pron)} style={{ alignSelf: 'flex-end', minHeight: 36, padding: '0 12px', fontSize: 13 }}>{t.talk.sayInsert}</button>
                  </div>
                )}
              </div>
            );
          })}
          {live !== null && <div style={bubble(false)}>{splitSay(live).body || <span style={{ opacity: .7 }}>{t.talk.thinking}</span>}<span className="blink">▌</span></div>}
          {error && <div role="alert" style={{ fontSize: 12, color: 'var(--vermilion)' }}>{error}</div>}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
          <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.talk.helperPlaceholder} aria-label={t.talk.helperAsk} enterKeyHint="send"
            style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '0 10px', border: '2px solid var(--ink)', background: 'var(--paper)', fontSize: 16, fontFamily: 'inherit' }} />
          <button type="submit" className="btn btn--primary" disabled={!draft.trim() || live !== null} aria-label={t.talk.send} style={{ minHeight: 44, padding: '0 14px' }}>▶</button>
        </form>
      </div>
    </div>
  );
};
