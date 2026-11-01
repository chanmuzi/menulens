import { useEffect, useRef, useState } from 'react';
import { savePhotos } from '../lib/savePhoto';
import type { ImageMode, MenuItem, Rate, Scan } from '../types';
import { TopBar } from '../components/TopBar';
import { Segmented } from '../components/Segmented';
import { OverlayView } from './OverlayView';
import { CardsView } from './CardsView';
import { ItemSheet } from './ItemSheet';
import { formatRateLine } from '../lib/money';
import { batchLines, canOrderScan, clearedBatchOrder, loadBatchOrder, saveBatchOrder, type BatchOrder, withBatchQty } from '../lib/order';
import { OrderBar } from '../components/OrderBar';
import { OrderSheet } from './OrderSheet';
import { DotGlyph } from '../components/DotGlyph';
import { BatchStrip } from '../components/BatchStrip';
import { ChatFab, FAB_SIZE, fabBottom } from '../components/ChatFab';
import { ChatPopup } from './ChatPopup';
import { chatTitle, kindLabel } from '../lib/kind';
import { useT } from '../i18n';

/** 보기 방식. App 이 들고 있어 읽는 중 사진(처리 중 화면)을 거쳐 돌아와도 유지된다 */
export type ResultView = 'overlay' | 'cards';
type Props = { readonly scan: Scan; readonly batch: readonly Scan[]; readonly view: ResultView; readonly onView: (v: ResultView) => void; /** 오버레이의 번역 표시(배지·덮개) 켜짐 */ readonly showMarks: boolean; readonly onShowMarks: (on: boolean) => void; /** 기록 이름(고친 이름 또는 자동 제목). 누르면 onRename */ readonly title: string; readonly onRename: () => void; readonly onSwitch: (id: string) => void; readonly onAdd: ((files: readonly File[]) => void) | undefined; readonly rate: Rate | null; readonly mode: ImageMode; readonly onMode: (m: ImageMode) => void; readonly onHome: () => void; /** 묶음 순서대로의 원본 파일(없으면 null → 화면용 사진으로 저장) */ readonly originalFiles: readonly (File | null)[] };

export const ResultScreen = ({ scan, batch, view, onView, showMarks, onShowMarks, title, onRename, onSwitch, onAdd, rate, mode, onMode, onHome, originalFiles }: Props) => {
  const t = useT();
  const isMenu = scan.kind === 'menu';
  // 안내문·기타는 카드가 의미 없으니 오버레이만 보여준다(view 는 App 상태)
  // 선택한 항목은 어느 사진 것인지 함께 든다(항목 id 가 사진마다 겹친다). 지금 보는 사진의 것만 화면에 쓴다
  const [selected, setSelected] = useState<{ readonly scanId: string; readonly item: MenuItem } | null>(null);
  const selectedItem = selected && selected.scanId === scan.id ? selected.item : null;
  const select = (item: MenuItem) => setSelected({ scanId: scan.id, item });
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  // 주문 수량: 묶음 전체(사진 id → 항목 id → 수량). 1번 사진에서 담은 것과 2번 사진에서 담은 것이 한 주문서가 된다. 저장은 사진별 키 그대로
  const [order, setOrder] = useState<BatchOrder>(() => loadBatchOrder(batch.map((s) => s.id)));
  const [orderOpen, setOrderOpen] = useState(false);
  // 주문서 바의 실제 높이(px). 말풍선 버튼과 아래 여백이 이 값 위에 앉는다(상수로 가정하면 글꼴 행간 차이로 겹친다)
  const [barHeight, setBarHeight] = useState(0);
  // 안내문 문단 선택: 덮개나 번역문 줄을 누르면 선택, 같은 것을 다시 누르면 해제(원문·번역은 사진 아래 정리 영역에 있어 시트를 띄우지 않는다)
  const [selectedNote, setSelectedNote] = useState<number | null>(null);
  const toggleNote = (i: number) => setSelectedNote((cur) => (cur === i ? null : i));
  // 오버레이의 번역 표시 토글(App 상태). 사진 안에 두면 사진을 가리고, 사진 위 전용 줄은 여백만 만들어 제목 줄 오른쪽에 둔다
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
  // 화면은 묶음 단위로 살아 있고(App 의 key), 사진을 바꾸면 사진에 딸린 선택만 닫는다. 보기 방식·표시 토글·주문서·챗(묶음에 하나)은 사진 사이에 유지.
  // 사진별 state 를 ResultScreen 에 추가하면 여기에도 넣는다(항목 id 가 사진마다 겹쳐 빠뜨리면 다른 사진의 항목이 선택된 채 보인다). 하위 뷰의 내부 상태(확대·필터·탭)는 key={scan.id} 로 초기화한다.
  // 참조 칩으로 다른 사진의 항목을 열 때는 사진을 바꾸면서 그 사진의 선택을 함께 넣으므로 지우지 않는다
  useEffect(() => { setSelectedNote(null); setSelected((s) => (s && s.scanId === scan.id ? s : null)); setChatFocus(null); setChatOpen(false); }, [scan.id]);
  const openChat = () => { setChatFocus(selectedItem); setSelected(null); setUnread(0); setChatMounted(true); setChatOpen(true); };
  /** 챗 참조 칩: 다른 사진의 항목이면 그 사진으로 바꾸고 상세를 연다 */
  const jumpTo = (scanId: string, item: MenuItem) => { setChatOpen(false); if (scanId !== scan.id) onSwitch(scanId); setSelected({ scanId, item }); };
  const overlayShown = view === 'overlay' || !isMenu;
  useEffect(() => { saveBatchOrder(order); }, [order]);
  /** 어느 사진의 어느 항목 수량. 카드·상세 시트는 지금 사진, 주문서 시트는 줄마다 자기 사진 */
  const setQtyOf = (scanId: string, id: string, qty: number) => setOrder((o) => withBatchQty(o, scanId, id, qty));
  const setQty = (id: string, qty: number) => setQtyOf(scan.id, id, qty);
  const currentOrder = order[scan.id] ?? {};
  const lines = batchLines(batch, order);
  const hasMenu = batch.some((s) => s.kind === 'menu');
  /** 주문 UI 를 보일지(order.ts 의 주문서 기준과 같다: 메뉴판이고 묶음의 첫 메뉴판과 원문 언어가 같을 때) */
  const canOrder = canOrderScan(scan, batch);
  const streaming = scan.status === 'streaming' || scan.status === 'reading';
  const detailing = scan.status === 'detailing';
  const counts: Record<string, number> = {};
  for (const it of scan.items) counts[it.category] = (counts[it.category] ?? 0) + 1;
  const summary = Object.entries(counts).map(([k, n]) => `${t.data.category[k as MenuItem['category']] ?? k} ${n}`).join(' · ');

  return (
    <div className="app">
      <TopBar onBack={onHome} backLabel={t.common.home} center={
        isMenu ? (
          <Segmented shadow label={t.result.viewLabel} value={view} onChange={onView} options={[{ value: 'overlay', label: t.result.viewOverlay }, { value: 'cards', label: t.result.viewCards }]} />
        ) : (
          <div className="dot" style={{ fontSize: 16 }}>{kindLabel(scan.kind)}</div>
        )
      } right={
        <button type="button" className="btn btn--icon" aria-label={t.result.savePhotosAria(batch.length)} title={t.result.savePhotoTitle} onClick={() => {
          // 묶음이면 전부 한 번에 공유 시트로
          void savePhotos(batch.map((s, i) => ({ file: originalFiles[i] ?? null, dataUrl: s.imageDataUrl }))).then((r) => {
            setSaveMsg(r.kind === 'shared' ? t.result.saveShared(r.count)
              : r.kind === 'opened' ? t.result.saveOpened(r.total)
              : r.kind === 'unsupported' ? t.result.saveUnsupported : null);
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
          {/* 기록 이름: 목록과 같은 이름을 보이고, 누르면 이름 고치기 */}
          <button type="button" onClick={onRename} aria-label={t.result.renameAria(title)} style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}>
            <span style={{ fontSize: 20, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{title}</span>
            <DotGlyph name="pencil" />
          </button>
          {/* 안내문·기타는 「N줄 번역 · 일본어만」 같은 부제를 두지 않는다(불필요하다는 피드백) */}
          {(isMenu || streaming || detailing) && <div className="muted small">
            {isMenu && <>{t.result.itemCount(scan.items.length)}{summary && ` · ${summary}`}{formatRateLine(rate, scan.currency) && ` · ${formatRateLine(rate, scan.currency)}`}</>}
            {streaming && <span className="blink">{isMenu ? ' ' : ''}▌</span>}
            {detailing && <span>{isMenu ? ` · ${t.result.writingDesc}` : t.result.writingNotice}<span className="blink">▌</span></span>}
          </div>}
        </div>
        {overlayShown && (
          <div className="seg" style={{ flexShrink: 0 }}>
            <button type="button" className="seg__btn seg__btn--small" aria-pressed={showMarks} onClick={() => onShowMarks(!showMarks)}>{showMarks ? t.result.marksOff : t.result.marksOn}</button>
          </div>
        )}
      </div>

      {overlayShown
        ? <OverlayView key={scan.id} scan={scan} selectedId={selectedItem?.id ?? null} onSelect={select} selectedNote={selectedNote} onNote={toggleNote} rate={rate} showMarks={showMarks} />
        : <CardsView key={scan.id} scan={scan} rate={rate} mode={mode} onMode={onMode} onSelect={select} order={currentOrder} onQty={canOrder ? setQty : undefined} />}

      {/* 아래 여백: 주문서 바(실측) + 말풍선 버튼 자리. 마지막 카드의 스테퍼가 버튼에 가려지지 않게 */}
      <div aria-hidden="true" style={{ height: fabBottom(barHeight) + FAB_SIZE + 16 }} />
      {hasMenu && <OrderBar lines={lines} rate={rate} onOpen={() => setOrderOpen(true)} onHeight={setBarHeight} />}
      {orderOpen && <OrderSheet lines={lines} rate={rate} photos={batch.length} onQty={setQtyOf} onClear={() => { setOrder(clearedBatchOrder); setOrderOpen(false); }} onClose={() => setOrderOpen(false)} />}
      {!orderOpen && !selectedItem && !chatOpen && <ChatFab title={chatTitle(scan.kind)} buttonRef={fabRef} unread={unread} barHeight={barHeight} onClick={openChat} />}
      {chatMounted && <ChatPopup batch={batch} scan={scan} open={chatOpen} focus={chatFocus} onClearFocus={() => setChatFocus(null)} onOpenItem={jumpTo} onClose={closeChat} onAnswered={() => { if (!chatOpenRef.current) setUnread((n) => n + 1); }} />}
      {selectedItem && <ItemSheet item={selectedItem} rate={rate} currency={scan.currency} lang={scan.lang} mode={mode} onClose={() => setSelected(null)} qty={isMenu && canOrder ? (currentOrder[selectedItem.id] ?? 0) : null} onQty={(q) => setQty(selectedItem.id, q)} pending={scan.status !== 'done' && scan.status !== 'error'} onAsk={openChat} />}
    </div>
  );
};
