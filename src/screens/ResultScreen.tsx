import { useEffect, useRef, useState } from 'react';
import { savePhotos } from '../lib/savePhoto';
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
import { KIND_LABEL } from '../lib/kind';
import { BatchStrip } from '../components/BatchStrip';
import { ChatFab } from '../components/ChatFab';
import { ChatPopup } from './ChatPopup';
import { chatTitle } from '../lib/kind';

type View = 'overlay' | 'cards';
type Props = { readonly scan: Scan; readonly batch: readonly Scan[]; readonly onSwitch: (id: string) => void; readonly onAdd: ((files: readonly File[]) => void) | undefined; readonly rate: Rate | null; readonly mode: ImageMode; readonly onMode: (m: ImageMode) => void; readonly onHome: () => void; /** 묶음 순서대로의 원본 파일(없으면 null → 화면용 사진으로 저장) */ readonly originalFiles: readonly (File | null)[] };

export const ResultScreen = ({ scan, batch, onSwitch, onAdd, rate, mode, onMode, onHome, originalFiles }: Props) => {
  const isMenu = scan.kind === 'menu';
  // 안내문·기타는 카드가 의미 없으니 오버레이만 보여준다
  const [view, setView] = useState<View>(isMenu ? 'cards' : 'overlay');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  // 주문 수량(메뉴판만). 스캔별로 기기에 저장
  const [order, setOrder] = useState<Order>(() => (isMenu ? loadOrder(scan.id) : {}));
  const [orderOpen, setOrderOpen] = useState(false);
  // 안내문 문단 선택: 덮개나 번역문 줄을 누르면 선택, 같은 것을 다시 누르면 해제(원문·번역은 사진 아래 정리 영역에 있어 시트를 띄우지 않는다)
  const [selectedNote, setSelectedNote] = useState<number | null>(null);
  const toggleNote = (i: number) => setSelectedNote((cur) => (cur === i ? null : i));
  useEffect(() => { setSelectedNote(null); }, [scan.id]);
  // 오버레이의 번역 표시 토글. 사진 안에 두면 사진을 가리고, 사진 위 전용 줄은 여백만 만들어 제목 줄 오른쪽에 둔다
  const [showMarks, setShowMarks] = useState(true);
  // 챗 팝업. 열려 있는 항목(카드 상세)이 있으면 맥락으로 붙고, 팝업을 닫은 뒤 온 답은 버튼 배지로 센다
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMounted, setChatMounted] = useState(false);
  // 답은 질문을 보낸 시점의 클로저에서 돌아오므로 열림 여부는 ref 로 본다
  const chatOpenRef = useRef(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  // 버튼은 팝업이 열린 동안 숨겨져 있어 닫은 뒤 다시 그려진 다음에 포커스를 돌려준다
  const closeChat = () => { setChatOpen(false); requestAnimationFrame(() => fabRef.current?.focus()); };
  chatOpenRef.current = chatOpen;
  const [chatFocus, setChatFocus] = useState<MenuItem | null>(null);
  const [unread, setUnread] = useState(0);
  const openChat = () => { setChatFocus(selected); setSelected(null); setUnread(0); setChatMounted(true); setChatOpen(true); };
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
          <div className="dot" style={{ fontSize: 16 }}>{KIND_LABEL[scan.kind]}</div>
        )
      } right={
        <button type="button" className="btn btn--icon" aria-label={batch.length > 1 ? `사진 ${batch.length}장을 기기에 저장` : '사진을 기기에 저장'} title="사진 저장" onClick={() => {
          // 묶음이면 전부 한 번에 공유 시트로
          void savePhotos(batch.map((s, i) => ({ file: originalFiles[i] ?? null, dataUrl: s.imageDataUrl }))).then((r) => {
            setSaveMsg(r.kind === 'shared' ? `공유 시트에서 「이미지 저장」을 누르면 ${r.count > 1 ? `${r.count}장이 ` : ''}사진 앱에 들어가요`
              : r.kind === 'opened' ? `새 탭의 사진을 길게 눌러 저장하세요${r.total > 1 ? ` (첫 장만 열었어요. 나머지는 사진을 옮겨 가며 저장)` : ''}`
              : r.kind === 'unsupported' ? '이 브라우저에선 저장을 지원하지 않아요' : null);
            setTimeout(() => setSaveMsg(null), 4000);
          });
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" shapeRendering="crispEdges" aria-hidden="true"><path d="M10 3v10M6 9l4 4 4-4M4 15v2h12v-2" /></svg>
        </button>
      } />
      {saveMsg && <div role="status" className="frame frame--flat" style={{ padding: '8px 12px', fontSize: 12 }}>{saveMsg}</div>}
      <BatchStrip scans={batch} currentId={scan.id} onSwitch={onSwitch} onAdd={onAdd} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="jp" style={{ fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{scan.shopName ?? (isMenu ? KIND_LABEL[scan.kind] : (scan.notes[0]?.text_ko ?? KIND_LABEL[scan.kind]))}</div>
          {/* 안내문·기타는 「N줄 번역 · 일본어만」 같은 부제를 두지 않는다(불필요하다는 피드백) */}
          {(isMenu || streaming || detailing) && <div className="muted small">
            {isMenu && <>{scan.items.length}개{summary && ` · ${summary}`}{formatRateLine(rate) && ` · ${formatRateLine(rate)}`}</>}
            {streaming && <span className="blink">{isMenu ? ' ' : ''}▌</span>}
            {detailing && <span>{isMenu ? ' · 설명 쓰는 중' : '번역·요약 쓰는 중'}<span className="blink">▌</span></span>}
          </div>}
        </div>
        {overlayShown && (
          <div className="seg" style={{ flexShrink: 0 }}>
            <button type="button" className="seg__btn seg__btn--small" aria-pressed={showMarks} onClick={() => setShowMarks((v) => !v)}>{showMarks ? '표시 끄기' : '표시 켜기'}</button>
          </div>
        )}
      </div>

      {overlayShown
        ? <OverlayView scan={scan} selectedId={selected?.id ?? null} onSelect={setSelected} selectedNote={selectedNote} onNote={toggleNote} rate={rate} showMarks={showMarks} />
        : <CardsView scan={scan} rate={rate} mode={mode} onMode={onMode} onSelect={setSelected} order={order} onQty={setQty} />}

      {/* 아래 여백: 주문서 바(72) + 말풍선 버튼 자리(72). 마지막 카드의 스테퍼가 버튼에 가려지지 않게 */}
      <div aria-hidden="true" style={{ height: (lines.length > 0 ? 72 : 0) + 72 }} />
      {isMenu && <OrderBar lines={lines} rate={rate} onOpen={() => setOrderOpen(true)} />}
      {orderOpen && <OrderSheet lines={lines} rate={rate} onQty={setQty} onClear={() => { setOrder({}); setOrderOpen(false); }} onClose={() => setOrderOpen(false)} />}
      {!orderOpen && !selected && !chatOpen && <ChatFab title={chatTitle(scan.kind)} buttonRef={fabRef} unread={unread} aboveBar={lines.length > 0} onClick={openChat} />}
      {chatMounted && <ChatPopup scan={scan} open={chatOpen} focus={chatFocus} onClearFocus={() => setChatFocus(null)} onOpenItem={(id) => { const it = scan.items.find((x) => x.id === id); if (it) { setChatOpen(false); setSelected(it); } }} onClose={closeChat} onAnswered={() => { if (!chatOpenRef.current) setUnread((n) => n + 1); }} />}
      {selected && <ItemSheet item={selected} rate={rate} mode={mode} onClose={() => setSelected(null)} qty={isMenu ? (order[selected.id] ?? 0) : null} onQty={(q) => setQty(selected.id, q)} pending={scan.status !== 'done' && scan.status !== 'error'} onAsk={openChat} />}
    </div>
  );
};
