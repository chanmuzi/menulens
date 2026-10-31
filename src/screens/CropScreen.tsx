/** 영역 지정. 모음 화면에서 사진 하나를 골라 잘라낼 부분을 끌어서 정하고, 잘린(또는 그대로인) File 을 돌려준다. */
import { useEffect, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { CropBox } from '../components/CropBox';
import { cropFile, FULL_RECT, isFullRect, type CropRect } from '../lib/crop';
import { useT } from '../i18n';

type Props = { readonly file: File; readonly onConfirm: (file: File) => void; readonly onCancel: () => void };

export const CropScreen = ({ file, onConfirm, onCancel }: Props) => {
  const t = useT();
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
      <TopBar onBack={busy ? undefined : onCancel} backLabel={t.confirm.crop.backToBatch} center={
        <div style={{ textAlign: 'center' }}>
          <div className="dot" style={{ fontSize: 16 }}>{t.confirm.crop.title}</div>
        </div>
      } />
      <div className="frame" style={{ background: 'var(--wood)', boxShadow: '4px 4px 0 var(--ink)', padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, maxHeight: '60dvh', overflow: 'hidden' }}>
        {url && (
          // 사진과 같은 크기의 상자: CropBox 의 0~1 좌표가 곧 사진 좌표가 되도록 inline-block 으로 감싼다
          <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0, userSelect: 'none' }}>
            <img src={url} alt={t.confirm.crop.imageAlt} draggable={false} style={{ maxWidth: '100%', maxHeight: 'calc(60dvh - 28px)', objectFit: 'contain' }} />
            <CropBox rect={rect} onChange={setRect} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>{cropped ? t.confirm.crop.onlyRed : t.confirm.crop.dragHint}</p>
        {cropped && <button type="button" className="btn btn--quiet" onClick={() => setRect(FULL_RECT)} style={{ minHeight: 36, padding: '0 8px', flexShrink: 0 }}>{t.confirm.crop.resetFull}</button>}
      </div>
      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--vermilion)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
        <button type="button" className="btn" onClick={onCancel} disabled={busy} style={{ flex: 1 }}>{t.common.cancel}</button>
        <button type="button" className="btn btn--primary" onClick={() => void confirm()} disabled={busy} style={{ flex: 2, fontWeight: 600 }}>{busy ? t.confirm.crop.cropping : cropped ? t.confirm.crop.useArea : t.confirm.crop.useWhole}</button>
      </div>
    </div>
  );
};
