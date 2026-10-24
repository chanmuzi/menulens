import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { PickSource, Scan } from '../types';
import { hasFiles, imageFromDropEvent } from '../lib/drop';
import { isIos, isIosStandalone } from '../lib/platform';
import { PixelIcon } from '../components/PixelIcon';
import { ScanRow } from '../components/ScanRow';
import { groupScans, type ScanGroup } from '../lib/history';
import { InstallHint } from '../components/InstallHint';
import type { InstallHint as Hint } from '../lib/platform';
import { whenLabel } from '../lib/when';
import { canReadClipboard, imageFromPasteEvent, readImageFromClipboard } from '../lib/clipboard';
import type { Talk } from '../types';
import { TalkRow } from '../components/TalkRow';
import { DotGlyph } from '../components/DotGlyph';
import { Segmented } from '../components/Segmented';
import { loadHomeTab, saveHomeTab, type HomeTab } from '../lib/storage';

type Props = {
  readonly scans: readonly Scan[];
  readonly installHint: Hint;
  /** 앨범은 여러 장, 촬영·붙여넣기·드롭은 한 장 */
  readonly onPick: (files: readonly File[], source: PickSource) => void;
  readonly onShowAll: () => void;
  readonly onOpen: (group: ScanGroup) => void;
  readonly onRename: (group: ScanGroup) => void;
  readonly onRemove: (group: ScanGroup) => void;
  /** 대화 통역 탭 */
  readonly talks: readonly Talk[];
  readonly onNewTalk: () => void;
  readonly onOpenTalk: (talk: Talk) => void;
  readonly onRenameTalk: (talk: Talk) => void;
  readonly onRemoveTalk: (talk: Talk) => void;
  readonly onShowAllTalks: () => void;
};

const HINT_BY_REASON = {
  empty: '클립보드에 이미지가 없어요',
  denied: '붙여넣기가 허용되지 않았어요 · 앨범에서 골라 주세요',
  unsupported: '이 브라우저는 붙여넣기를 지원하지 않아요',
} as const;
const HINT_MS = 3000;

/** 홈에는 최근 몇 묶음만. 나머지는 「전체 보기」 */
const HOME_RECENT = 5;

export const HomeScreen = ({ scans, installHint, onPick, onShowAll, onOpen, onRename, onRemove, talks, onNewTalk, onOpenTalk, onRenameTalk, onRemoveTalk, onShowAllTalks }: Props) => {
  /** 사진 읽기 / 대화 통역. 마지막으로 고른 탭을 기억한다(대화에서 홈으로 돌아오면 대화 탭) */
  const [tab, setTab] = useState<HomeTab>(loadHomeTab);
  const changeTab = (t: HomeTab) => { saveHomeTab(t); setTab(t); };
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  // 같은 문구가 연달아 떠도 타이머가 다시 시작되도록 객체로 든다 (같은 문자열은 React 가 갱신을 건너뛴다)
  const [hint, setHint] = useState<{ readonly text: string; readonly at: number } | null>(null);
  const pasteSupported = canReadClipboard();
  const [dragging, setDragging] = useState(false);
  /** iOS 홈 화면 앱 등에서 clipboard.read 가 막혔을 때 띄우는 붙여넣기 상자 */
  const [pasteBox, setPasteBox] = useState(false);
  const pasteBoxRef = useRef<HTMLDivElement>(null);
  const groups = groupScans(scans);
  const handle = (source: PickSource) => (e: ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (list.length > 0) onPick(list, source);
  };

  // 잠깐 보였다 사라지는 안내. 기본 문구 자리에 띄워 화면을 더 가리지 않는다
  useEffect(() => {
    if (hint === null) return;
    const t = window.setTimeout(() => setHint(null), HINT_MS);
    return () => window.clearTimeout(t);
  }, [hint]);

  // 데스크톱: 홈 화면에서 Ctrl/Cmd+V
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = imageFromPasteEvent(e);
      if (!f) return;
      e.preventDefault();
      onPick([f], 'paste');
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [onPick]);

  // 붙여넣기 상자가 뜨면 포커스를 줘서 길게 누르면 바로 「붙여넣기」 메뉴가 나오게 한다
  useEffect(() => { if (pasteBox) pasteBoxRef.current?.focus(); }, [pasteBox]);

  // 데스크톱: 화면 어디에나 이미지 파일을 끌어다 놓기 (기본 동작 차단은 App 이 모든 화면에서 맡는다)
  useEffect(() => {
    const onOver = (e: DragEvent) => { if (hasFiles(e)) setDragging(true); };
    const onLeave = (e: DragEvent) => { if (e.relatedTarget === null) setDragging(false); };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      setDragging(false);
      const f = imageFromDropEvent(e);
      if (f) onPick([f], 'drop');
      else setHint({ text: '이미지 파일만 넣을 수 있어요', at: Date.now() });
    };
    document.addEventListener('dragover', onOver);
    document.addEventListener('dragleave', onLeave);
    document.addEventListener('drop', onDrop);
    return () => { document.removeEventListener('dragover', onOver); document.removeEventListener('dragleave', onLeave); document.removeEventListener('drop', onDrop); };
  }, [onPick]);

  // 모바일: 버튼 탭 → 클립보드 읽기 (사용자 동작 안에서 호출해야 한다)
  const pasteFromButton = async () => {
    const r = await readImageFromClipboard();
    if (r.ok) { onPick([r.file], 'paste'); return; }
    if (isIos()) { setPasteBox(true); return; } // 상자를 길게 눌러 네이티브 「붙여넣기」 → paste 이벤트
    setHint({ text: HINT_BY_REASON[r.reason], at: Date.now() });
  };

  return (
    <div className="app">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, background: 'var(--vermilion)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PixelIcon icon="camera" size={2} />
          </div>
          <div className="dot" style={{ fontSize: 20, lineHeight: 1 }}>MENULENS</div>
        </div>
        <div className="dot" style={{ height: 40, padding: '0 10px', border: '2px solid var(--ink)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          {tab === 'menu' ? <>日本語 <span style={{ color: 'var(--vermilion)' }}>→</span> 한국어</> : <>한국어 <span style={{ color: 'var(--vermilion)' }}>⇄</span> 日本語</>}
        </div>
      </header>

      <div className="notice-tabs">
        <Segmented label="기능" value={tab} onChange={changeTab} options={[{ value: 'menu', label: '사진 읽기', icon: 'camera' }, { value: 'talk', label: '대화 통역', icon: 'talk' }]} />
      </div>

      {tab === 'talk' ? (
        <>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>말하거나 쓰면 일본어로,<br />들으면 한국어로 보여드려요</h1>
          <div className="corners frame" style={{ background: 'var(--paper-dark)', boxShadow: '4px 4px 0 var(--ink)', padding: '28px 18px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="c3" /><span className="c4" />
            <TalkMock />
            <button type="button" className="btn btn--primary" onClick={onNewTalk} style={{ marginTop: 10, minHeight: 60, borderWidth: 3, boxShadow: '4px 4px 0 var(--ink)', fontSize: 18, fontWeight: 600 }}>
              <DotGlyph name="mic" size={18} />새 대화 시작
            </button>
          </div>
          {talks.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="dot" style={{ fontSize: 14 }}>최근 대화</div>
                {talks.length > HOME_RECENT && (
                  <button type="button" className="btn btn--quiet" onClick={onShowAllTalks} style={{ minHeight: 32, padding: '0 6px' }}>전체 보기 ({talks.length}) ›</button>
                )}
              </div>
              {talks.slice(0, HOME_RECENT).map((t) => <TalkRow key={t.id} talk={t} when={whenLabel(t.updatedAt)} onOpen={onOpenTalk} onRename={onRenameTalk} onRemove={onRemoveTalk} />)}
            </section>
          )}
          <InstallHint hint={installHint} />
        </>
      ) : (<>

      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>메뉴판이나 안내문을 찍으면<br />바로 읽어드려요</h1>

      {/* 뷰파인더: 사진이 여기 찍혀 번역된다는 걸 그림으로. 설명 문구 대신 메뉴판 모형 + 스캔 라인 + 번역 칩. 안내·오류 문구는 필요할 때만 그 위에 */}
      <div className="corners frame" style={{ background: dragging ? 'var(--paper-2)' : 'var(--paper-dark)', outline: dragging ? '3px dashed var(--vermilion)' : 'none', outlineOffset: -8, boxShadow: '4px 4px 0 var(--ink)', padding: 18, minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 18, overflow: 'hidden' }}>
        <span className="c3" /><span className="c4" />
        <MenuMock />
        {/* 라이브 영역은 늘 두고 문구만 넣었다 뺀다(영역과 문구가 같이 생기면 낭독기가 읽지 않을 수 있다) */}
        <div role="status" style={{ position: 'absolute', top: 96, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          {(dragging || hint) && (
            <div style={{ background: 'var(--paper-2)', border: '2px solid var(--ink)', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: hint ? 'var(--vermilion)' : undefined, maxWidth: 'calc(100% - 48px)', textAlign: 'center' }}>{dragging ? '여기에 놓으면 확인 화면으로 가요' : hint?.text}</div>
          )}
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, marginTop: 170 }}>
          <button type="button" className="btn" onClick={() => albumRef.current?.click()}>앨범에서</button>
          <button type="button" className="btn btn--primary" onClick={() => cameraRef.current?.click()} style={{ width: 78, height: 78, borderWidth: 3, boxShadow: '4px 4px 0 var(--ink)', fontSize: 18, fontWeight: 600 }}>촬영</button>
          {isIosStandalone()
            // 홈 화면 앱은 클립보드 API 가 막혀 있어 버튼을 길게 눌러 iOS 「붙여넣기」 메뉴로 받는다 (paste 이벤트 → document 리스너)
            ? <div role="button" tabIndex={0} contentEditable suppressContentEditableWarning inputMode="none" className="btn" aria-label="길게 눌러 붙여넣기"
                onInput={(e) => { e.currentTarget.textContent = '붙여넣기'; }}
                onClick={() => setHint({ text: '버튼을 길게 눌러 「붙여넣기」를 고르세요', at: Date.now() })}
                style={{ caretColor: 'transparent', userSelect: 'text', WebkitUserSelect: 'text' }}>붙여넣기</div>
            : pasteSupported
              ? <button type="button" className="btn" onClick={() => void pasteFromButton()}>붙여넣기</button>
              : <div style={{ width: 78 }} />}
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handle('camera')} className="sr-only" aria-label="카메라로 촬영" />
        <input ref={albumRef} type="file" accept="image/*" multiple onChange={handle('album')} className="sr-only" aria-label="앨범에서 선택" />
      </div>

      {scans.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="dot" style={{ fontSize: 14 }}>최근 스캔</div>
            {groups.length > HOME_RECENT && (
              <button type="button" className="btn btn--quiet" onClick={onShowAll} style={{ minHeight: 32, padding: '0 6px' }}>전체 보기 ({groups.length}) ›</button>
            )}
          </div>
          {groups.slice(0, HOME_RECENT).map((g) => <ScanRow key={g.key} group={g} when={whenLabel(g.at)} onOpen={onOpen} onRename={onRename} onRemove={onRemove} />)}
        </section>
      )}

      {pasteBox && (
        <div className="frame frame--flat" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--paper-dark)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
            <span>붙여넣기 권한이 막혀 있어요. 아래 상자를 <strong>길게 눌러 「붙여넣기」</strong>를 고르세요</span>
            <button type="button" className="btn btn--quiet" onClick={() => setPasteBox(false)} aria-label="닫기" style={{ minHeight: 32, padding: '0 6px' }}>✕</button>
          </div>
          <div ref={pasteBoxRef} contentEditable suppressContentEditableWarning inputMode="none" aria-label="붙여넣기 상자" onInput={(e) => { e.currentTarget.textContent = ''; }}
            style={{ minHeight: 56, border: '2px dashed var(--vermilion)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'var(--muted)', outline: 'none', caretColor: 'transparent' }}>
            여기를 길게 누르기
          </div>
        </div>
      )}
      <InstallHint hint={installHint} />
      </>)}
    </div>
  );
};

/** 대화 통역 모형: 내 말(오른쪽, 원문 작게 + 일본어 크게)과 상대 말(왼쪽, 먹색)이 쌓이는 모습. 실제 번역 결과에서 가져온 문장 */
const TalkMock = () => (
  <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ alignSelf: 'flex-end', maxWidth: '80%', background: 'var(--paper-2)', border: '2px solid var(--ink)', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>그럼 하나 부탁할게요</span>
      <span className="jp" style={{ fontSize: 17 }}>じゃあ、一つお願いします</span>
    </div>
    <div style={{ alignSelf: 'flex-start', maxWidth: '84%', background: 'var(--ink)', color: 'var(--paper)', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-jp)', fontSize: 11, color: '#D9CCB4' }}>お水はセルフサービスになっております</span>
      <span style={{ fontSize: 15, fontWeight: 700 }}>물은 셀프서비스입니다.</span>
    </div>
  </div>
);

/** 메뉴판 모형: 나무판 위 종이 한 장에 글줄(막대)과 그림, 그 위를 지나는 스캔 라인, 한 줄이 번역 칩으로 뜬 모습 */
const MenuMock = () => (
  <div aria-hidden="true" style={{ position: 'absolute', left: 44, right: 44, top: 30, height: 160, background: 'var(--wood)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ position: 'relative', width: 150, height: 128, background: '#F7EFDD', border: '2px solid var(--ink)', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      {[[0.75, true], [0.55, false], [0.65, false], [0.45, false], [0.6, false]].map(([w, head], i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: `${(w as number) * 100}%`, height: head ? 8 : 6, background: head ? 'var(--ink)' : '#B8AC9B', opacity: i === 1 ? 0.25 : 1 }} />
          {i !== 1 && <div style={{ width: 14, height: 6, background: 'var(--vermilion)', opacity: .8, marginLeft: 'auto' }} />}
        </div>
      ))}
      {/* 두 번째 줄이 번역돼 떠오른 칩 */}
      <div className="pop" style={{ position: 'absolute', left: 10, top: 29, display: 'flex', alignItems: 'center', gap: 5, background: 'var(--paper-2)', border: '2px solid var(--ink)', boxShadow: '2px 2px 0 var(--ink)', padding: '2px 6px', fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>
        <PixelIcon icon="ramen" size={1} />라멘 <span className="dot" style={{ color: 'var(--vermilion)' }}>¥900</span>
      </div>
      <div className="scanline" style={{ left: 0, right: 0 }} />
    </div>
  </div>
);
