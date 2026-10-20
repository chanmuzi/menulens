import { useState } from 'react';
import { savePhoto } from '../lib/savePhoto';
import type { ImageMode, MenuItem, Rate, Scan } from '../types';
import { TopBar } from '../components/TopBar';
import { Segmented } from '../components/Segmented';
import { OverlayView } from './OverlayView';
import { CardsView } from './CardsView';
import { ItemSheet } from './ItemSheet';
import { formatRateLine } from '../lib/money';

type View = 'overlay' | 'cards';
type Props = { readonly scan: Scan; readonly rate: Rate | null; readonly mode: ImageMode; readonly onMode: (m: ImageMode) => void; readonly onHome: () => void; readonly originalFile: File | null };

const KIND_LABEL = { menu: '메뉴판', sign: '안내문', other: '사진 속 글자' } as const;

export const ResultScreen = ({ scan, rate, mode, onMode, onHome, originalFile }: Props) => {
  const [view, setView] = useState<View>('cards');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const streaming = scan.status === 'streaming' || scan.status === 'reading';
  const detailing = scan.status === 'detailing';
  const counts: Record<string, number> = {};
  for (const it of scan.items) counts[it.category] = (counts[it.category] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(' · ');

  return (
    <div className="app">
      <TopBar onBack={onHome} backLabel="홈으로" center={
        <div style={{ position: 'relative' }}>
          <Segmented shadow label="보기 방식" value={view} onChange={setView} options={[{ value: 'cards', label: '카드' }, { value: 'overlay', label: '오버레이' }]} />
          <span aria-hidden="true" className="dot" style={{ position: 'absolute', top: -9, right: -10, fontSize: 8, padding: '1px 4px', background: 'var(--vermilion)', color: 'var(--paper-2)', border: '1px solid var(--ink)', lineHeight: 1.2, letterSpacing: '0.1em' }}>BETA</span>
        </div>
      } right={
        <button type="button" className="btn btn--icon" aria-label="사진을 기기에 저장" title="사진 저장" onClick={() => {
          void savePhoto(originalFile, scan.imageDataUrl).then((r) => {
            setSaveMsg(r === 'shared' ? '공유 시트에서 「이미지 저장」을 누르면 사진 앱에 들어가요' : r === 'opened' ? '새 탭의 사진을 길게 눌러 저장하세요' : r === 'unsupported' ? '이 브라우저에선 저장을 지원하지 않아요' : null);
            setTimeout(() => setSaveMsg(null), 4000);
          });
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" shapeRendering="crispEdges" aria-hidden="true"><path d="M10 3v10M6 9l4 4 4-4M4 15v2h12v-2" /></svg>
        </button>
      } />
      {saveMsg && <div role="status" className="frame frame--flat" style={{ padding: '8px 12px', fontSize: 12 }}>{saveMsg}</div>}

      <div style={{ minWidth: 0 }}>
        <div className="jp" style={{ fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.shopName ?? KIND_LABEL[scan.kind]}</div>
        <div className="muted small">
          {scan.items.length}개{summary && ` · ${summary}`}{formatRateLine(rate) && ` · ${formatRateLine(rate)}`}
          {streaming && <span className="blink"> ▌</span>}
          {detailing && <span> · 설명 쓰는 중<span className="blink">▌</span></span>}
        </div>
      </div>

      {view === 'overlay'
        ? <OverlayView scan={scan} selectedId={selected?.id ?? null} onSelect={setSelected} />
        : <CardsView scan={scan} rate={rate} mode={mode} onMode={onMode} onSelect={setSelected} />}

      {selected && <ItemSheet item={selected} rate={rate} mode={mode} onClose={() => setSelected(null)} />}
    </div>
  );
};
