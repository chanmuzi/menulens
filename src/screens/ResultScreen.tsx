import { useState } from 'react';
import type { ImageMode, MenuItem, Rate, Scan } from '../types';
import { TopBar } from '../components/TopBar';
import { Segmented } from '../components/Segmented';
import { OverlayView } from './OverlayView';
import { CardsView } from './CardsView';
import { ItemSheet } from './ItemSheet';
import { formatRateLine } from '../lib/money';

type View = 'overlay' | 'cards';
type Props = { readonly scan: Scan; readonly rate: Rate | null; readonly mode: ImageMode; readonly onMode: (m: ImageMode) => void; readonly onHome: () => void };

const KIND_LABEL = { menu: '메뉴판', sign: '안내문', other: '사진 속 글자' } as const;

const sec = (ms: number | null): string => (ms === null ? '-' : `${(ms / 1000).toFixed(1)}s`);

export const ResultScreen = ({ scan, rate, mode, onMode, onHome }: Props) => {
  const [view, setView] = useState<View>('cards');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const streaming = scan.status === 'streaming' || scan.status === 'reading';
  const counts: Record<string, number> = {};
  for (const it of scan.items) counts[it.category] = (counts[it.category] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(' · ');
  const t = scan.timing;
  const timingLine = t.totalMs !== null ? `OCR ${sec(t.ocrMs)} · 첫 항목 ${sec(t.firstItemMs)} · 완료 ${sec(t.totalMs)}` : null;

  return (
    <div className="app">
      <TopBar onBack={onHome} backLabel="홈으로" center={
        <Segmented shadow label="보기 방식" value={view} onChange={setView} options={[
          { value: 'cards', label: '카드' },
          { value: 'overlay', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>오버레이<span style={{ fontSize: 8, padding: '1px 3px', border: '1px solid currentColor', lineHeight: 1, letterSpacing: '0.08em' }}>BETA</span></span> },
        ]} />
      } />

      <div style={{ minWidth: 0 }}>
        <div className="jp" style={{ fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.shopName ?? KIND_LABEL[scan.kind]}</div>
        <div className="muted small">
          {scan.items.length}개{summary && ` · ${summary}`}{formatRateLine(rate) && ` · ${formatRateLine(rate)}`}
          {streaming && <span className="blink"> ▌</span>}
        </div>
        {timingLine && <div className="dot muted" style={{ fontSize: 10, marginTop: 2 }}>{timingLine}</div>}
      </div>

      {view === 'overlay'
        ? <OverlayView scan={scan} selectedId={selected?.id ?? null} onSelect={setSelected} />
        : <CardsView scan={scan} rate={rate} mode={mode} onMode={onMode} onSelect={setSelected} />}

      {selected && <ItemSheet item={selected} rate={rate} mode={mode} onClose={() => setSelected(null)} />}
    </div>
  );
};
