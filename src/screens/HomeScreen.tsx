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

type Props = {
  readonly scans: readonly Scan[];
  readonly installHint: Hint;
  /** 앨범은 여러 장, 촬영·붙여넣기·드롭은 한 장 */
  readonly onPick: (files: readonly File[], source: PickSource) => void;
  readonly onShowAll: () => void;
  readonly onOpen: (group: ScanGroup) => void;
  readonly onRemove: (group: ScanGroup) => void;
};

const HINT_DEFAULT = '글자가 전부 들어오게 찍어 주세요';
const HINT_BY_REASON = {
  empty: '클립보드에 이미지가 없어요',
  denied: '붙여넣기가 허용되지 않았어요 · 앨범에서 골라 주세요',
  unsupported: '이 브라우저는 붙여넣기를 지원하지 않아요',
} as const;
const HINT_MS = 3000;

/** 홈에는 최근 몇 묶음만. 나머지는 「전체 보기」 */
const HOME_RECENT = 5;

export const HomeScreen = ({ scans, installHint, onPick, onShowAll, onOpen, onRemove }: Props) => {
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
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, lineHeight: 1.3 }}>메뉴판이나 안내문을 찍으면<br />바로 읽어드려요</h1>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>메뉴판은 요리 설명·주문서까지, 안내문은 줄마다 번역</p>
      </div>

      <div className="corners frame" style={{ background: dragging ? 'var(--paper-2)' : 'var(--paper-dark)', outline: dragging ? '3px dashed var(--vermilion)' : 'none', outlineOffset: -8, boxShadow: '4px 4px 0 var(--ink)', padding: 18, minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 18, overflow: 'hidden' }}>
        <span className="c3" /><span className="c4" />
        <div aria-hidden="true" style={{ position: 'absolute', left: 44, right: 44, top: 34, height: 150, background: 'var(--wood)', opacity: .35, display: 'flex', gap: 12, padding: 14, justifyContent: 'center' }}>
          {Array.from({ length: 5 }, (_, i) => <div key={i} style={{ width: 30, background: '#EFE4C8' }} />)}
        </div>
        <div style={{ position: 'absolute', top: 96, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div role="status" style={{ background: 'var(--paper-2)', border: '2px solid var(--ink)', padding: '8px 12px', fontSize: 13, fontWeight: 500, color: hint ? 'var(--vermilion)' : undefined, maxWidth: 'calc(100% - 48px)', textAlign: 'center' }}>{dragging ? '여기에 놓으면 확인 화면으로 가요' : (hint?.text ?? HINT_DEFAULT)}</div>
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
            <div className="dot" style={{ fontSize: 14 }}>最近 · 최근 스캔</div>
            {groups.length > HOME_RECENT && (
              <button type="button" className="btn btn--quiet" onClick={onShowAll} style={{ minHeight: 32, padding: '0 6px' }}>전체 보기 ({groups.length}) ›</button>
            )}
          </div>
          {groups.slice(0, HOME_RECENT).map((g) => <ScanRow key={g.key} group={g} when={whenLabel(g.at)} onOpen={onOpen} onRemove={onRemove} />)}
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
    </div>
  );
};
