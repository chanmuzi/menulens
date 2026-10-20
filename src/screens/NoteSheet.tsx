/** 안내문 한 줄의 상세 바텀시트: 원문(크게)·번역·복사. 안내문에는 주문·가격이 없다. */
import { useEffect, useState } from 'react';
import type { Note } from '../types';

type Props = { readonly note: Note; readonly onClose: () => void };

export const NoteSheet = ({ note, onClose }: Props) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const copy = async () => { try { await navigator.clipboard.writeText(note.text_ja); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 불가 */ } };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="note-title" style={{ position: 'fixed', inset: 0, zIndex: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button type="button" aria-label="닫기" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: 'var(--paper-2)', borderTop: '3px solid var(--ink)', padding: '12px 20px calc(20px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div aria-hidden="true" style={{ width: 40, height: 4, background: 'var(--paper-dark)', alignSelf: 'center' }} />
        <div className="dot small" style={{ color: 'var(--vermilion)' }}>원문</div>
        <div id="note-title" className="jp" style={{ fontSize: 22, lineHeight: 1.4 }}>{note.text_ja}</div>
        <div className="dot small" style={{ color: 'var(--vermilion)' }}>번역</div>
        <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.45 }}>{note.text_ko}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => void copy()} style={{ flex: 1 }}>{copied ? '복사했어요' : '원문 복사'}</button>
          <button type="button" className="btn btn--primary" onClick={onClose} style={{ flex: 1 }}>닫기</button>
        </div>
      </div>
    </div>
  );
};
