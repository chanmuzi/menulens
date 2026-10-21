/** 말풍선 버튼 위로 뜨는 챗 팝업. 사진에 맞는 칩 3개(「다른 질문」으로 섞음) + 자유 입력, 지금 보는 항목이 있으면 맥락 칩. 닫기는 말풍선 버튼(✕) 하나.
 *  글자(항목 JSON)로 먼저 묻고, 서버가 [사진 필요] 라고 하거나 질문에 「놓친·사진」류 말이 있으면 사진을 붙여 묻는다. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { MenuItem, Scan } from '../types';
import { PixelIcon } from '../components/PixelIcon';
import { popupBottom } from '../components/ChatFab';
import { askMenu, chatContext, imagePart, loadChat, saveChat, wantsImage, type ChatMsg } from '../lib/chat';
import { chatTitle, nextSeed, quickQuestions } from '../lib/chatChips';

type Props = {
  readonly scan: Scan;
  /** 닫아도 내리지 않고 숨긴다: 진행 중인 답이 끊기지 않고, 닫힌 뒤 온 답은 버튼 배지로 알린다 */
  readonly open: boolean;
  readonly aboveBar: boolean;
  /** 지금 열려 있는 항목(카드 상세·오버레이 선택). 맥락 칩으로 붙는다 */
  readonly focus: MenuItem | null;
  readonly onClearFocus: () => void;
  readonly onOpenItem: (id: string) => void;
  readonly onClose: () => void;
  /** 새 답이 왔을 때(팝업이 닫힌 뒤 배지용) */
  readonly onAnswered: () => void;
};

const bubble = (mine: boolean) => ({
  alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '92%', padding: '8px 10px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const,
  background: mine ? 'var(--ink)' : 'var(--paper)', color: mine ? 'var(--paper)' : 'var(--ink)', border: '2px solid var(--ink)', boxShadow: mine ? 'none' : '2px 2px 0 var(--ink)',
});

export const ChatPopup = ({ scan, open, aboveBar, focus, onClearFocus, onOpenItem, onClose, onAnswered }: Props) => {
  const [msgs, setMsgs] = useState<readonly ChatMsg[]>(() => loadChat(scan.id));
  const [draft, setDraft] = useState('');
  /** 스트리밍 중인 답(아직 msgs 에 없음) */
  const [live, setLive] = useState<{ text: string; image: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 칩 조합 seed. 열 때마다·「다른 질문」마다 바뀐다 */
  const [seed, setSeed] = useState(() => Date.now() % 1000);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const ac = useRef<AbortController | null>(null);
  const itemById = new Map(scan.items.map((it) => [it.id, it]));

  useEffect(() => { saveChat(scan.id, msgs); }, [scan.id, msgs]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs, live]);
  // 화면을 떠나(다른 사진·홈) 끊기면 질문만 남지 않게 끊김 표시를 남긴다
  useEffect(() => () => { if (ac.current && !ac.current.signal.aborted) { ac.current.abort(); const saved = loadChat(scan.id); if (saved[saved.length - 1]?.role === 'me') saveChat(scan.id, [...saved, { role: 'bot', text: '(화면을 떠나서 답이 끊겼어요. 다시 물어봐 주세요)', refs: [], sawImage: false, at: Date.now() }]); } }, [scan.id]);
  // 열리면 포커스를 팝업 안으로(입력칸 자동 포커스는 iOS 키보드를 띄우니 피한다)
  useEffect(() => { if (open) { boxRef.current?.focus(); setSeed((n) => n + 1); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || live) return;
    setError(null);
    setDraft('');
    const mine: ChatMsg = { role: 'me', text: q, refs: [], sawImage: false, at: Date.now() };
    const history = msgs;
    setMsgs((m) => [...m, mine]);
    ac.current?.abort();
    const ctrl = new AbortController();
    ac.current = ctrl;
    const context = chatContext(scan);
    const image = imagePart(scan.imageDataUrl);
    const withImage = wantsImage(q) && image !== null;
    setLive({ text: '', image: withImage });
    try {
      const run = (img: typeof image) => askMenu({ context, focus: focus?.id ?? null, question: q, history, image: img }, (t) => setLive({ text: t, image: img !== null }), ctrl.signal);
      let r = await run(withImage ? image : null);
      // 글자만으로 못 답하면 사진을 붙여 한 번 더
      if (r.kind === 'need_image') {
        if (!image || withImage) throw new Error('사진이 없어서 답할 수 없어요');
        setLive({ text: '', image: true });
        r = await run(image);
        if (r.kind === 'need_image') throw new Error('사진을 봐도 찾지 못했어요');
      }
      setMsgs((m) => [...m, { role: 'bot', text: r.text, refs: r.refs, sawImage: r.sawImage, at: Date.now() }]);
      onAnswered();
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (ac.current === ctrl) setLive(null);
    }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void ask(draft); };

  const refChips = (refs: readonly string[]) => refs.map((k) => itemById.get(k)).filter((it): it is MenuItem => it !== undefined).slice(0, 4);

  return (
    <div role="dialog" aria-modal="true" aria-label={chatTitle(scan.kind)} hidden={!open} style={{ position: 'fixed', inset: 0, zIndex: 21, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.35)', border: 0, cursor: 'pointer' }} />
      <div ref={boxRef} tabIndex={-1} aria-busy={live !== null} style={{ position: 'relative', outline: 'none', width: 'calc(100% - 24px)', maxWidth: 456, maxHeight: '72dvh', marginBottom: `calc(${popupBottom(aboveBar)}px + var(--safe-bottom))`, background: 'var(--paper-2)', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)', display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px 12px' }}>
        <div aria-hidden="true" style={{ position: 'absolute', right: 16, bottom: -12, width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '12px solid var(--ink)' }} />
        {/* 닫기는 아래 말풍선 버튼(✕)이 맡는다. 머리에 ✕ 를 또 두면 같은 정보가 둘이라 뺐다 */}
        <span className="dot" style={{ fontSize: 14 }}>{chatTitle(scan.kind)}</span>
        {focus && (
          <span className="chip" style={{ alignSelf: 'flex-start', gap: 6 }}>지금 보는: <span className="jp">{focus.name_ja}</span>
            <button type="button" aria-label="맥락 지우기" onClick={onClearFocus} style={{ border: 0, background: 'transparent', padding: '6px 8px', margin: '-6px -8px -6px 0', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, minHeight: 32 }}>✕</button>
          </span>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {quickQuestions(scan, focus !== null, seed).map((q) => (
            <button key={q} type="button" className="chip" disabled={live !== null} onClick={() => void ask(q)} style={{ cursor: 'pointer', fontSize: 12, padding: '6px 10px', minHeight: 32 }}>{q}</button>
          ))}
          <button type="button" aria-label="다른 질문 보기" onClick={() => setSeed((n) => nextSeed(scan, focus !== null, n))} className="dot" style={{ border: 0, background: 'transparent', color: 'var(--muted)', fontSize: 14, minHeight: 32, minWidth: 32, padding: '0 6px', cursor: 'pointer' }}>↻</button>
        </div>
        {/* 스크린리더용: 완료된 마지막 답만 읽는다(조각마다 읽히지 않게) */}
        <div className="sr-only" role="status">{msgs.length > 0 && msgs[msgs.length - 1]!.role === 'bot' ? msgs[msgs.length - 1]!.text : ''}</div>
        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0, flex: 1 }}>
          {msgs.length === 0 && !live && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--muted)', fontSize: 13 }}><PixelIcon icon="bubble" size={2} />읽어 둔 글로 먼저 답하고, 사진을 다시 봐야 하면 그렇게 표시할게요.</div>
          )}
          {msgs.map((m, i) => (
            <div key={`${m.at}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: m.role === 'me' ? 'flex-end' : 'flex-start' }}>
              <div style={bubble(m.role === 'me')}>{m.text}</div>
              {m.role === 'bot' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: 'var(--muted)' }}>
                  <span>{m.sawImage ? '사진을 다시 봤어요' : '글자만 보고 답함'}</span>
                  {refChips(m.refs).map((it) => (
                    <button key={it.id} type="button" className="chip chip--accent" onClick={() => onOpenItem(it.id)} style={{ cursor: 'pointer', minHeight: 28, padding: '2px 8px' }}>{it.name_ko} ›</button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {live && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              <div style={bubble(false)}>{live.text || <span style={{ opacity: .7 }}>{live.image ? '사진을 다시 보는 중' : '생각 중'}</span>}<span className="blink">▌</span></div>
            </div>
          )}
          {error && <div role="alert" style={{ fontSize: 12, color: 'var(--vermilion)' }}>{error}</div>}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
          <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={msgs.length ? '더 물어보기' : '궁금한 걸 물어보세요'} aria-label="질문"
            enterKeyHint="send" style={{ flex: 1, minWidth: 0, minHeight: 40, padding: '0 10px', border: '2px solid var(--ink)', background: 'var(--paper)', fontSize: 14, fontFamily: 'inherit' }} />
          <button type="submit" className="btn btn--primary" disabled={!draft.trim() || live !== null} aria-label="보내기" style={{ minHeight: 40, padding: '0 14px' }}>▶</button>
        </form>
      </div>
    </div>
  );
};
