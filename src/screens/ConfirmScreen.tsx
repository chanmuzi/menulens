/** 분석 전 확인. 고른 사진을 보여주고 「분석하기」를 눌러야 서버로 간다. 「영역 지정」을 켜면 잘라낼 부분을 끌어서 정한다. */
import { useEffect, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { CropBox } from '../components/CropBox';
import { cropFile, FULL_RECT, isFullRect, type CropRect } from '../lib/crop';

type Props = { readonly file: File; readonly onConfirm: (file: File) => void; readonly onCancel: () => void };

export const ConfirmScreen = ({ file, onConfirm, onCancel }: Props) => {
  // object URL 은 효과 안에서 만들고 같은 효과의 정리에서 지운다 (StrictMode 의 이중 실행에도 깨지지 않도록)
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => { URL.revokeObjectURL(u); };
  }, [file]);

  const [rect, setRect] = useState<CropRect>(FULL_RECT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cropped = !isFullRect(rect);

  const confirm = async () => {
    if (!cropped) { onConfirm(file); return; }
    setBusy(true); setError(null);
    try { onConfirm(await cropFile(file, rect)); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <div className="app">
      <TopBar onBack={onCancel} backLabel="다시 고르기" center={
        <div style={{ textAlign: 'center' }}>
          <div className="dot" style={{ fontSize: 16 }}>이 사진으로 할까요?</div>
        </div>
      } />
      <div className="frame" style={{ background: 'var(--wood)', boxShadow: '4px 4px 0 var(--ink)', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, maxHeight: '60dvh', overflow: 'hidden' }}>
        {url && (
          // 사진과 같은 크기의 상자: CropBox 의 0~1 좌표가 곧 사진 좌표가 되도록 inline-block 으로 감싼다
          <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, userSelect: 'none' }}>
            <img src={url} alt="고른 사진" draggable={false} style={{ maxWidth: '100%', maxHeight: 'calc(60dvh - 28px)', objectFit: 'contain' }} />
            <CropBox rect={rect} onChange={setRect} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>{cropped ? '빨간 영역만 분석해요' : '모서리를 끌면 글자 부분만 남길 수 있어요'}</p>
        {cropped && <button type="button" className="btn btn--quiet" onClick={() => setRect(FULL_RECT)} style={{ minHeight: 36, padding: '0 8px', flexShrink: 0 }}>전체로</button>}
      </div>
      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--vermilion)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
        <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>다시 고르기</button>
        <button type="button" className="btn btn--primary" onClick={() => void confirm()} disabled={busy} style={{ flex: 2, fontWeight: 600 }}>{busy ? '잘라내는 중…' : cropped ? '이 영역만 분석하기' : '분석하기'}</button>
      </div>
    </div>
  );
};
