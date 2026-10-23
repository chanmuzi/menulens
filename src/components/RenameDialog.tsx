/** 기록 이름 고치기. 이모지를 고르는 UI 는 없고 글자만 고친다(자동 제목의 이모지는 입력란에 그대로 들어 있어 지우거나 키보드로 바꾼다). 비우거나 자동 제목과 같게 저장하면 자동 제목으로 돌아간다. 모양은 ConfirmDialog 와 같다. */
import { useEffect, useState, type FormEvent } from 'react';

type Props = {
  /** 지금 보이는 이름(고친 이름 또는 자동 제목) */
  readonly current: string;
  readonly auto: string;
  /** 사용자가 고친 이름이 있는지(「자동 제목으로」 버튼을 보일지) */
  readonly edited: boolean;
  readonly onCancel: () => void;
  /** null = 자동 제목으로 */
  readonly onSave: (name: string | null) => void;
};

const MAX = 30;

export const RenameDialog = ({ current, auto, edited, onCancel, onSave }: Props) => {
  const [name, setName] = useState(current);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    onSave(v && v !== auto ? v : null);
  };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rename-title" style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <form onSubmit={submit} className="frame" style={{ position: 'relative', width: '100%', maxWidth: 360, boxShadow: '4px 4px 0 var(--ink)', padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div id="rename-title" className="dot" style={{ fontSize: 16 }}>이름 고치기</div>
        <label htmlFor="rename-input" className="muted small" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          이름
          <input id="rename-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX} autoFocus autoComplete="off" enterKeyHint="done" onFocus={(e) => e.currentTarget.select()}
            style={{ font: 'inherit', fontSize: 16, color: 'var(--ink)', background: 'var(--paper)', border: '2px solid var(--ink)', padding: '8px 10px', width: '100%', minWidth: 0 }} />
        </label>
        <div className="muted small" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ overflowWrap: 'anywhere' }}>자동 제목: {auto}</span>
          {edited && <button type="button" onClick={() => onSave(null)} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', color: 'var(--vermilion)', textDecoration: 'underline', cursor: 'pointer' }}>자동 제목으로</button>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>취소</button>
          <button type="submit" className="btn btn--primary" style={{ flex: 1 }}>저장</button>
        </div>
      </form>
    </div>
  );
};
