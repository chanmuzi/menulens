import { useEffect, useState } from 'react';
import { savePhoto } from '../lib/savePhoto';
import type { ImageMode, MenuItem, Rate, Scan } from '../types';
import { TopBar } from '../components/TopBar';
import { Segmented } from '../components/Segmented';
import { OverlayView } from './OverlayView';
import { CardsView } from './CardsView';
import { ItemSheet } from './ItemSheet';
import { formatRateLine } from '../lib/money';
import { loadOrder, orderLines, saveOrder, withQty, type Order } from '../lib/order';
import { OrderBar } from '../components/OrderBar';
import { OrderSheet } from './OrderSheet';
import { NoteSheet } from './NoteSheet';
import type { Note } from '../types';
import { KIND_LABEL, KIND_SUB } from '../lib/kind';
import { BatchStrip } from '../components/BatchStrip';

type View = 'overlay' | 'cards';
type Props = { readonly scan: Scan; readonly batch: readonly Scan[]; readonly onSwitch: (id: string) => void; readonly rate: Rate | null; readonly mode: ImageMode; readonly onMode: (m: ImageMode) => void; readonly onHome: () => void; readonly originalFile: File | null };

export const ResultScreen = ({ scan, batch, onSwitch, rate, mode, onMode, onHome, originalFile }: Props) => {
  const isMenu = scan.kind === 'menu';
  // 안내문·기타는 카드가 의미 없으니 오버레이만 보여준다
  const [view, setView] = useState<View>(isMenu ? 'cards' : 'overlay');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  // 주문 수량(메뉴판만). 스캔별로 기기에 저장
  const [order, setOrder] = useState<Order>(() => (isMenu ? loadOrder(scan.id) : {}));
  const [orderOpen, setOrderOpen] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  // 오버레이의 번역 표시 토글. 사진 안에 두면 사진을 가리고, 사진 위 전용 줄은 여백만 만들어 제목 줄 오른쪽에 둔다
  const [showMarks, setShowMarks] = useState(true);
  const overlayShown = view === 'overlay' || !isMenu;
  useEffect(() => { if (isMenu) saveOrder(scan.id, order); }, [isMenu, scan.id, order]);
  const setQty = (id: string, qty: number) => setOrder((o) => withQty(o, id, qty));
  const lines = isMenu ? orderLines(scan, order) : [];
  const streaming = scan.status === 'streaming' || scan.status === 'reading';
  const detailing = scan.status === 'detailing';
  const counts: Record<string, number> = {};
  for (const it of scan.items) counts[it.category] = (counts[it.category] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(' · ');

  return (
    <div className="app">
      <TopBar onBack={onHome} backLabel="홈으로" center={
        isMenu ? (
          <div style={{ position: 'relative' }}>
            <Segmented shadow label="보기 방식" value={view} onChange={setView} options={[{ value: 'cards', label: '카드' }, { value: 'overlay', label: '오버레이' }]} />
            <span aria-hidden="true" className="dot" style={{ position: 'absolute', top: -9, right: -10, fontSize: 8, padding: '1px 4px', background: 'var(--vermilion)', color: 'var(--paper-2)', border: '1px solid var(--ink)', lineHeight: 1.2, letterSpacing: '0.1em' }}>BETA</span>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div className="dot" style={{ fontSize: 16 }}>{KIND_LABEL[scan.kind]}</div>
            <div className="dot muted" style={{ fontSize: 11 }}>{KIND_SUB[scan.kind]}</div>
          </div>
        )
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
      <BatchStrip scans={batch} currentId={scan.id} onSwitch={onSwitch} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="jp" style={{ fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.shopName ?? (isMenu ? KIND_LABEL[scan.kind] : (scan.notes[0]?.text_ko ?? KIND_LABEL[scan.kind]))}</div>
          <div className="muted small">
            {isMenu ? <>{scan.items.length}개{summary && ` · ${summary}`}{formatRateLine(rate) && ` · ${formatRateLine(rate)}`}</> : <>{scan.notes.length}줄 번역 · 일본어만</>}
            {streaming && <span className="blink"> ▌</span>}
            {detailing && <span> · 설명 쓰는 중<span className="blink">▌</span></span>}
          </div>
        </div>
        {overlayShown && (
          <div className="seg" style={{ flexShrink: 0 }}>
            <button type="button" className="seg__btn seg__btn--small" aria-pressed={showMarks} onClick={() => setShowMarks((v) => !v)}>{showMarks ? '표시 끄기' : '표시 켜기'}</button>
          </div>
        )}
      </div>

      {overlayShown
        ? <OverlayView scan={scan} selectedId={selected?.id ?? null} onSelect={setSelected} onNote={setNote} showMarks={showMarks} />
        : <CardsView scan={scan} rate={rate} mode={mode} onMode={onMode} onSelect={setSelected} order={order} onQty={setQty} />}

      {lines.length > 0 && <div aria-hidden="true" style={{ height: 72 }} />}
      {isMenu && <OrderBar lines={lines} rate={rate} onOpen={() => setOrderOpen(true)} />}
      {orderOpen && <OrderSheet lines={lines} rate={rate} onQty={setQty} onClear={() => { setOrder({}); setOrderOpen(false); }} onClose={() => setOrderOpen(false)} />}
      {note && <NoteSheet note={note} onClose={() => setNote(null)} />}
      {selected && <ItemSheet item={selected} rate={rate} mode={mode} onClose={() => setSelected(null)} qty={isMenu ? (order[selected.id] ?? 0) : null} onQty={(q) => setQty(selected.id, q)} pending={scan.status !== 'done' && scan.status !== 'error'} />}
    </div>
  );
};
