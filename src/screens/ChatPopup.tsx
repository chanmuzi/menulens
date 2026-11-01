/** 화면 아래에 붙는 챗 시트. 자유 입력 + 지금 보는 항목이 있으면 맥락 칩. 닫기는 시트 우상단 ✕(말풍선 버튼은 열려 있는 동안 숨김). 추천 질문 칩은 자리만 차지해 뺐다(2026-10-22).
 *  글자(항목 JSON)로 먼저 묻고, 서버가 [사진 필요] 라고 하거나 질문에 「놓친·사진」류 말이 있으면 사진을 붙여 묻는다.
 *  여러 장 묶음이면 사진 전부의 항목이 맥락이고, 사진은 모델이 번호로 지정한 한 장만(질문당 최대 2장) 붙인다. 대화는 묶음에 하나. */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { MenuItem, Scan } from '../types';
import { PixelIcon } from '../components/PixelIcon';
import { askMenu, chatContext, imagePart, itemKey, loadBatchChat, loadChat, photoInQuestion, refFromKey, resolveRef, saveChat, wantsImage, type ChatMsg } from '../lib/chat';
import { chatTitle } from '../lib/kind';
import { dict, useT } from '../i18n';

type Props = {
  /** 묶음 전부(한 장이면 하나). 맥락은 이 전체 */
  readonly batch: readonly Scan[];
  /** 지금 보는 사진. 제목·「지금 보는 항목」·사진을 붙일 기본 장 */
  readonly scan: Scan;
  /** 닫아도 내리지 않고 숨긴다: 진행 중인 답이 끊기지 않고, 닫힌 뒤 온 답은 버튼 배지로 알린다 */
  readonly open: boolean;
  /** 지금 열려 있는 항목(카드 상세·오버레이 선택, 지금 보는 사진의 것). 맥락 칩으로 붙는다 */
  readonly focus: MenuItem | null;
  readonly onClearFocus: () => void;
  /** 참조 칩: 어느 사진의 어느 항목을 열지 */
  readonly onOpenItem: (scanId: string, item: MenuItem) => void;
  readonly onClose: () => void;
  /** 새 답이 왔을 때(팝업이 닫힌 뒤 배지용) */
  readonly onAnswered: () => void;
};

const bubble = (mine: boolean) => ({
  alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '92%', padding: '8px 10px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' as const, overflowWrap: 'anywhere' as const,
  background: mine ? 'var(--ink)' : 'var(--paper)', color: mine ? 'var(--paper)' : 'var(--ink)', border: '2px solid var(--ink)', boxShadow: mine ? 'none' : '2px 2px 0 var(--ink)',
});

/** 질문당 붙일 수 있는 사진 수(비용 상한) */
const MAX_IMAGES_PER_ASK = 2;

export const ChatPopup = ({ batch, scan, open, focus, onClearFocus, onOpenItem, onClose, onAnswered }: Props) => {
  const t = useT();
  const photos = batch.length;
  const currentPhoto = Math.max(1, batch.findIndex((s) => s.id === scan.id) + 1);
  // 대화 저장 키: 마운트 때 묶음에서 완료된(기록에 저장되는) 첫 사진. 실패한 사진은 기록에 남지 않아 그 키로 저장하면 다시 열 때 대화가 사라진다. 한 번 정하면 바꾸지 않는다(바뀌면 정리 effect 가 진행 중인 답을 끊는다)
  const [chatKey] = useState(() => batch.find((s) => s.status === 'done' || s.status === 'detailing')?.id ?? scan.id);
  const [msgs, setMsgs] = useState<readonly ChatMsg[]>(() => loadBatchChat(batch.map((s) => s.id)));
  const [draft, setDraft] = useState('');
  /** 스트리밍 중인 답(아직 msgs 에 없음). photo 는 붙인 사진 번호 */
  const [live, setLive] = useState<{ text: string; photo: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const ac = useRef<AbortController | null>(null);

  useEffect(() => { saveChat(chatKey, msgs); }, [chatKey, msgs]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs, live]);
  // 화면을 떠나(홈) 끊기면 질문만 남지 않게 끊김 표시를 남긴다
  useEffect(() => () => { if (ac.current && !ac.current.signal.aborted) { ac.current.abort(); const saved = loadChat(chatKey); if (saved[saved.length - 1]?.role === 'me') saveChat(chatKey, [...saved, { role: 'bot', text: dict().chat.disconnected, refs: [], sawImage: false, at: Date.now() }]); } }, [chatKey]);
  // 열리면 포커스를 팝업 안으로(입력칸 자동 포커스는 iOS 키보드를 띄우니 피한다)
  useEffect(() => { if (open) boxRef.current?.focus(); }, [open]);
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
    const context = chatContext(batch, scan.kind, (batch.find((s) => s.id === chatKey) ?? scan).lang);
    const focusKey = focus ? itemKey(currentPhoto, focus.id, photos) : null;
    const imageOf = (n: number) => imagePart(batch[n - 1]?.imageDataUrl ?? '');
    // 처음부터 사진이 필요해 보이면 질문이 부른 사진(「2번 사진 아래 작은 글씨」), 없으면 지금 보는 사진을 붙인다. 모델이 다른 장을 지정하면 그 장을 한 번 더
    const tried = new Set<number>();
    const asked = photoInQuestion(q);
    const first = asked !== null && asked >= 1 && asked <= photos ? asked : currentPhoto;
    let photo: number | null = wantsImage(q) && imageOf(first) ? first : null;
    if (photo) tried.add(photo);
    setLive({ text: '', photo });
    try {
      const run = (n: number | null) => askMenu({ context, focus: focusKey, question: q, history, image: n ? imageOf(n) : null, imagePhoto: n }, (t) => setLive({ text: t, photo: n }), ctrl.signal);
      let r = await run(photo);
      while (r.kind === 'need_image') {
        const want = r.photo ?? currentPhoto;
        if (tried.has(want) || tried.size >= MAX_IMAGES_PER_ASK) throw new Error(t.chat.notFoundWithPhoto);
        if (!imageOf(want)) throw new Error(t.chat.noPhoto);
        tried.add(want);
        photo = want;
        setLive({ text: '', photo });
        r = await run(photo);
      }
      // 참조는 모델이 적은 키(묶음 안 번호)가 아니라 사진 id 로 저장한다(기록에서 다시 열 때 실패한 사진이 빠져 번호가 당겨져도 안 어긋나게)
      const refs = r.refs.flatMap((k) => { const ref = refFromKey(batch, k, scan.id); return ref ? [ref] : []; });
      setMsgs((m) => [...m, { role: 'bot', text: r.text, refs, sawImage: r.sawImage, sawScan: r.sawImage && photo ? (batch[photo - 1]?.id ?? null) : null, at: Date.now() }]);
      onAnswered();
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (ac.current === ctrl) setLive(null);
    }
  };
  // 보내면 키보드를 내린다. 답이 오는 동안 키보드가 화면 절반을 가리고 있으면 답을 읽으려고 닫았다 다시 열어야 한다
  const submit = (e: FormEvent) => { e.preventDefault(); inputRef.current?.blur(); void ask(draft); };

  /** 참조 키를 묶음 전체에서 찾는다(최대 4). 다른 사진의 항목이면 칩에 사진 번호를 붙인다 */
  const refChips = (refs: readonly string[]) => [...new Set(refs)].flatMap((ref) => { const r = resolveRef(batch, ref); return r ? [{ key: ref, ...r, photo: batch.findIndex((s) => s.id === r.scanId) + 1 }] : []; }).slice(0, 4);
  /** 「2번 사진을」: 묶음이고 그 사진이 띠에 있을 때만 번호를 붙인다(아니면 null → 「사진을」) */
  const photoNo = (scanId: string | null | undefined): number | null => { const n = scanId ? batch.findIndex((s) => s.id === scanId) + 1 : 0; return photos > 1 && n > 0 ? n : null; };

  return (
    <div role="dialog" aria-modal="true" aria-label={chatTitle(scan.kind)} hidden={!open} style={{ position: 'fixed', inset: 0, zIndex: 21, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button type="button" tabIndex={-1} aria-hidden="true" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.35)', border: 0, cursor: 'pointer' }} />
      {/* 화면 바닥에 붙는 시트(주문서 바가 있어도 그 위에 덮는다 — 배경막이 바를 가리므로 띄울 이유가 없고, 입력칸이 키보드 바로 위에 와야 한다) */}
      <div ref={boxRef} tabIndex={-1} aria-busy={live !== null} style={{ position: 'relative', outline: 'none', width: '100%', maxWidth: 480, maxHeight: '72dvh', background: 'var(--paper-2)', borderTop: '3px solid var(--ink)', display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 14px calc(12px + var(--safe-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className="dot" style={{ fontSize: 14 }}>{chatTitle(scan.kind)}{photos > 1 && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{t.chat.photoCount(photos)}</span>}</span>
          <button type="button" className="btn btn--quiet" onClick={onClose} aria-label={t.common.close} style={{ minHeight: 36, minWidth: 36, padding: '0 8px', fontSize: 16, color: 'var(--ink)' }}>✕</button>
        </div>
        {focus && (
          <span className="chip" style={{ alignSelf: 'flex-start', gap: 6 }}>{t.chat.focusPrefix}<span lang={scan.lang.src} className={scan.lang.src === 'ja' ? 'jp' : undefined}>{focus.name}</span>
            <button type="button" aria-label={t.chat.clearFocus} onClick={onClearFocus} style={{ border: 0, background: 'transparent', padding: '6px 8px', margin: '-6px -8px -6px 0', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, minHeight: 32 }}>✕</button>
          </span>
        )}
        {/* 스크린리더용: 완료된 마지막 답만 읽는다(조각마다 읽히지 않게) */}
        <div className="sr-only" role="status">{msgs.length > 0 && msgs[msgs.length - 1]!.role === 'bot' ? msgs[msgs.length - 1]!.text : ''}</div>
        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0, flex: 1 }}>
          {msgs.length === 0 && !live && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--muted)', fontSize: 13 }}><PixelIcon icon="bubble" size={2} />{t.chat.intro(photos)}</div>
          )}
          {msgs.map((m, i) => (
            <div key={`${m.at}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: m.role === 'me' ? 'flex-end' : 'flex-start' }}>
              <div style={bubble(m.role === 'me')}>{m.text}</div>
              {m.role === 'bot' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', fontSize: 11, color: 'var(--muted)' }}>
                  <span>{m.sawImage ? t.chat.sawPhoto(photoNo(m.sawScan)) : t.chat.textOnly}</span>
                  {refChips(m.refs).map((r) => (
                    <button key={r.key} type="button" className="chip chip--accent" onClick={() => onOpenItem(r.scanId, r.item)} style={{ cursor: 'pointer', minHeight: 28, padding: '2px 8px' }}>{r.item.tr}{photos > 1 && r.photo !== currentPhoto ? ` · ${t.chat.photoN(r.photo)}` : ''} ›</button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {live && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
              <div style={bubble(false)}>{live.text || <span style={{ opacity: .7 }}>{live.photo ? t.chat.rePhoto(photoNo(batch[live.photo - 1]?.id)) : t.chat.thinking}</span>}<span className="blink">▌</span></div>
            </div>
          )}
          {error && <div role="alert" style={{ fontSize: 12, color: 'var(--vermilion)' }}>{error}</div>}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
          <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={msgs.length ? t.chat.placeholderMore : t.chat.placeholderFirst} aria-label={t.chat.inputAria}
            enterKeyHint="send" style={{ flex: 1, minWidth: 0, minHeight: 40, padding: '0 10px', border: '2px solid var(--ink)', background: 'var(--paper)', fontSize: 14, fontFamily: 'inherit' }} />
          <button type="submit" className="btn btn--primary" disabled={!draft.trim() || live !== null} aria-label={t.chat.send} style={{ minHeight: 40, padding: '0 14px' }}>▶</button>
        </form>
      </div>
    </div>
  );
};
