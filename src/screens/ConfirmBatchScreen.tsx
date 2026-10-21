/** 여러 장 확인. 썸네일을 보여주고 빼고 싶은 사진을 뺀 뒤 「N장 분석하기」. 영역 지정은 한 장일 때만(ConfirmScreen) */
import { useEffect, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { BATCH_MAX } from '../lib/batch';

type Props = { readonly files: readonly File[]; readonly onConfirm: (files: readonly File[]) => void; readonly onCancel: () => void };

export const ConfirmBatchScreen = ({ files, onConfirm, onCancel }: Props) => {
  const [kept, setKept] = useState<readonly File[]>(() => files.slice(0, BATCH_MAX));
  const [urls, setUrls] = useState<readonly string[]>([]);
  useEffect(() => {
    const list = kept.map((f) => URL.createObjectURL(f));
    setUrls(list);
    return () => { list.forEach((u) => URL.revokeObjectURL(u)); };
  }, [kept]);
  const dropped = files.length - Math.min(files.length, BATCH_MAX);

  return (
    <div className="app">
      <TopBar onBack={onCancel} backLabel="다시 고르기" center={
        <div style={{ textAlign: 'center' }}>
          <div className="dot" style={{ fontSize: 16 }}>{kept.length}장을 한 번에 읽을까요?</div>
        </div>
      } />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {kept.map((f, i) => (
          <div key={`${f.name}-${f.size}-${i}`} className="frame" style={{ position: 'relative', aspectRatio: '1', background: 'var(--wood)', overflow: 'hidden' }}>
            {urls[i] && <img src={urls[i]} alt={`고른 사진 ${i + 1}`} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <span className="dot" style={{ position: 'absolute', left: 0, top: 0, padding: '1px 6px', background: 'var(--ink)', color: 'var(--paper)', fontSize: 11 }}>{i + 1}</span>
            {kept.length > 1 && (
              <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => setKept((k) => k.filter((_, j) => j !== i))}
                style={{ position: 'absolute', right: 0, top: 0, width: 26, height: 26, padding: 0, background: 'var(--paper-2)', border: 0, borderLeft: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)', cursor: 'pointer', fontSize: 13 }}>✕</button>
            )}
          </div>
        ))}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
        사진마다 따로 읽어서 끝나는 대로 보여드려요. 영역 지정은 한 장만 골랐을 때 할 수 있어요.
        {dropped > 0 && <> 한 번에 {BATCH_MAX}장까지라 뒤의 {dropped}장은 뺐어요.</>}
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
        <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>다시 고르기</button>
        <button type="button" className="btn btn--primary" onClick={() => onConfirm(kept)} disabled={kept.length === 0} style={{ flex: 2, fontWeight: 600 }}>{kept.length}장 분석하기</button>
      </div>
    </div>
  );
};
