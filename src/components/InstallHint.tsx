/** 「홈 화면에 추가」 안내. 한 줄로 접혀 있고 「방법」을 누르면 두 줄 더 펼친다. 닫으면 다시 보이지 않는다. */
import { useState } from 'react';
import type { InstallHint as Hint } from '../lib/platform';

type Props = { readonly hint: Hint };

export const InstallHint = ({ hint }: Props) => {
  const [open, setOpen] = useState(false);
  if (hint.kind === 'none') return null;
  return (
    <div className="frame frame--flat" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, background: 'var(--paper-dark)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, lineHeight: 1.4 }}>홈 화면에 추가하면 앱처럼 열리고 기록도 지워지지 않아요</span>
        {hint.kind === 'prompt'
          ? <button type="button" className="btn" onClick={() => void hint.install()} style={{ minHeight: 36, padding: '0 10px', fontSize: 13 }}>추가</button>
          : <button type="button" className="btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ minHeight: 36, padding: '0 10px', fontSize: 13 }}>방법</button>}
        <button type="button" className="btn btn--quiet" onClick={hint.dismiss} aria-label="안내 닫기" style={{ minHeight: 36, padding: '0 6px' }}>✕</button>
      </div>
      {open && hint.kind === 'ios' && (
        <ol className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Safari 아래쪽 <strong>공유</strong> 버튼(네모에 화살표)을 누르고</li>
          <li><strong>홈 화면에 추가</strong>를 고른 뒤 「추가」</li>
        </ol>
      )}
    </div>
  );
};
