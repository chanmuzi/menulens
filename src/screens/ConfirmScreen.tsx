/** 분석 전 확인. 고른 사진을 보여주고 「분석하기」를 눌러야 서버로 간다. 나중에 「영역 지정」(크롭)이 여기에 붙는다. */
import { useEffect, useState } from 'react';
import { TopBar } from '../components/TopBar';

type Props = { readonly file: File; readonly onConfirm: () => void; readonly onCancel: () => void };

export const ConfirmScreen = ({ file, onConfirm, onCancel }: Props) => {
  // object URL 은 효과 안에서 만들고 같은 효과의 정리에서 지운다 (StrictMode 의 이중 실행에도 깨지지 않도록)
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => { URL.revokeObjectURL(u); };
  }, [file]);

  return (
    <div className="app">
      <TopBar onBack={onCancel} backLabel="다시 고르기" center={
        <div style={{ textAlign: 'center' }}>
          <div className="dot" style={{ fontSize: 16 }}>이 사진으로 할까요?</div>
          <div className="dot muted" style={{ fontSize: 11 }}>かくにん</div>
        </div>
      } />
      <div className="corners frame" style={{ background: 'var(--wood)', boxShadow: '4px 4px 0 var(--ink)', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, maxHeight: '60dvh', overflow: 'hidden' }}>
        <span className="c3" /><span className="c4" />
        {url && <img src={url} alt="고른 사진" style={{ maxWidth: '100%', maxHeight: 'calc(60dvh - 20px)', objectFit: 'contain' }} />}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13, textAlign: 'center' }}>메뉴판 글자가 잘 보이면 분석을 시작해요</p>
      <div style={{ display: 'flex', gap: 10, marginTop: 'auto' }}>
        <button type="button" className="btn" onClick={onCancel} style={{ flex: 1 }}>다시 고르기</button>
        <button type="button" className="btn btn--primary" onClick={onConfirm} style={{ flex: 2, fontWeight: 600 }}>분석하기</button>
      </div>
    </div>
  );
};
