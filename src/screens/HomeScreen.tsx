import { useRef, type ChangeEvent } from 'react';
import type { Scan } from '../types';
import { PixelIcon } from '../components/PixelIcon';

type Props = {
  readonly scans: readonly Scan[];
  readonly onPick: (file: File) => void;
  readonly onOpen: (scan: Scan) => void;
  readonly onRemove: (id: string) => void;
};

const whenLabel = (ts: number): string => {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const hm = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (sameDay) return `오늘 ${hm}`;
  const diff = Math.round((today.setHours(0, 0, 0, 0) - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
  return diff === 1 ? '어제' : `${d.getMonth() + 1}/${d.getDate()}`;
};

export const HomeScreen = ({ scans, onPick, onOpen, onRemove }: Props) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) onPick(f);
  };

  return (
    <div className="app">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, background: 'var(--vermilion)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PixelIcon icon="camera" size={2} />
          </div>
          <div>
            <div className="dot" style={{ fontSize: 20, lineHeight: 1 }}>MENULENS</div>
            <div className="dot muted" style={{ fontSize: 11, lineHeight: 1, marginTop: 3 }}>めにゅーれんず</div>
          </div>
        </div>
        <div className="dot" style={{ height: 40, padding: '0 10px', border: '2px solid var(--ink)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          日本語 <span style={{ color: 'var(--vermilion)' }}>→</span> 한국어
        </div>
      </header>

      <div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>메뉴판을 찍으면<br />바로 읽어드려요</h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>번역 · 요리 설명 · 대표 이미지까지 한 번에</p>
      </div>

      <div className="corners frame" style={{ background: 'var(--paper-dark)', boxShadow: '4px 4px 0 var(--ink)', padding: 18, minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 18, overflow: 'hidden' }}>
        <span className="c3" /><span className="c4" />
        <div aria-hidden="true" style={{ position: 'absolute', left: 44, right: 44, top: 34, height: 150, background: 'var(--wood)', opacity: .35, display: 'flex', gap: 12, padding: 14, justifyContent: 'center' }}>
          {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ width: 30, background: '#EFE4C8' }} />)}
        </div>
        <div style={{ position: 'absolute', top: 96, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: 'var(--paper-2)', border: '2px solid var(--ink)', padding: '8px 12px', fontSize: 13, fontWeight: 500 }}>메뉴판 전체가 들어오게 찍어 주세요</div>
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, marginTop: 170 }}>
          <button type="button" className="btn" onClick={() => albumRef.current?.click()}>앨범에서</button>
          <button type="button" className="btn btn--primary" onClick={() => cameraRef.current?.click()} style={{ width: 78, height: 78, borderWidth: 3, boxShadow: '4px 4px 0 var(--ink)', fontSize: 18, fontWeight: 600 }}>촬영</button>
          <div style={{ width: 78 }} />
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handle} className="sr-only" aria-label="카메라로 촬영" />
        <input ref={albumRef} type="file" accept="image/*" onChange={handle} className="sr-only" aria-label="앨범에서 선택" />
      </div>

      {scans.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="dot" style={{ fontSize: 14 }}>最近 · 최근 스캔</div>
          {scans.map((s) => (
            <div key={s.id} className="frame frame--flat" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
              <button type="button" onClick={() => onOpen(s)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
                <div style={{ width: 48, height: 48, background: 'var(--paper-dark)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PixelIcon icon={s.items[0]?.icon ?? 'rice'} size={2} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="jp" style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.shopName ?? (s.items[0]?.name_ja ?? '메뉴판')}</div>
                  <div className="muted small">{s.items.length}개 메뉴 · {whenLabel(s.createdAt)}</div>
                </div>
              </button>
              <button type="button" className="btn btn--quiet" onClick={() => onRemove(s.id)} aria-label="이 스캔 지우기" style={{ minHeight: 36, padding: '0 8px' }}>지우기</button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
