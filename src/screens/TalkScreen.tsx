/**
 * 대화 통역 화면. 말풍선이 좌우로 쌓이고(내 말 오른쪽, 상대 말 왼쪽, 연달아 말해도 된다), 아래에서 말하기·글로 쓰기.
 * 내 언어는 대화를 만들 때의 앱 언어(talk.lang.me), 상대는 그 반대. 말하기 버튼은 내 언어가 왼쪽(주홍), 상대 언어가 오른쪽(먹).
 * 말하기: 녹음(recorder) → /api/stt → 마디 추가 → /api/talk 번역(필드가 오는 대로 채움). 글로 쓰기는 녹음만 건너뛴다(한국어·일본어 자동 판별).
 * 내 말풍선을 누르면 상대에게 크게 보여준다. 오른쪽 위 반짝이는 도우미(상대에게 안 보이는 질문).
 * 대화는 마디가 끝날 때마다 저장되고(App → talkStore), 완료 2·6마디에 자동 제목을 짓는다.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { HelperMsg, Talk, TalkPair, TalkTurn } from '../types';
import { applyFields, bubbleView, contextTurns, needsTitle, newTurn, talkTitle, withTranslation } from '../lib/talk';
import { fetchTitle, SttUnavailableError, transcribe, translate } from '../lib/talkApi';
import { isAccessCodeError } from '../lib/apiError';
import { canRecord, startRecording, type RecorderHandle } from '../lib/recorder';
import { loadTalkPrefs, saveTalkPrefs, type TalkPrefs } from '../lib/storage';
import { TalkBubble } from '../components/TalkBubble';
import { ShowBig } from '../components/ShowBig';
import { DotGlyph } from '../components/DotGlyph';
import { TalkHelper } from './TalkHelper';
import { useT, type Dict } from '../i18n';

type Props = {
  readonly talk: Talk;
  /** 마디가 끝날 때마다(번역 중인 마디가 없을 때) 저장한다 */
  readonly onSave: (talk: Talk) => void;
  readonly onHome: () => void;
  readonly onRename: (talk: Talk) => void;
};

type Lang = 'ko' | 'ja';
type Show = { readonly text: string; readonly lang: 'ko' | 'ja' | 'en'; readonly kana: string; readonly pron: string };

const PAIRS: readonly TalkPair[] = ['ko-ja', 'ko-en', 'ja-en'];

/**
 * 말하기 버튼 색 정책(2026-10-23 사용자): 두 버튼은 같은 모양(너비·글꼴)이고 색은 언제나 다르다. 말풍선과 맞춰 내 언어 = 주홍, 상대 언어 = 먹.
 * 평소: 그 색으로 채움. 녹음 중: 뒤집어 종이 바탕 + 그 색 굵은 테두리·글자 + ● 깜빡임 + 그 색 소리 막대, 눌린 듯 그림자 없음. 다른 쪽은 흐리게.
 */
const ROLE_COLOR: Readonly<Record<'me' | 'them', string>> = { me: 'var(--vermilion)', them: 'var(--ink)' };

type TalkDict = Dict['talk'];
/** 다시 될 때까지 남은 시간 → 「40초 」「12분 」「2시간 」 */
const waitLabel = (t: TalkDict, s: number): string => (s < 60 ? t.wait.seconds(s) : s < 3600 ? t.wait.minutes(Math.ceil(s / 60)) : t.wait.hours(Math.ceil(s / 3600)));
const sttNotice = (t: TalkDict, retryAfter: number | null): string =>
  retryAfter !== null ? t.sttLimited(waitLabel(t, retryAfter)) : t.sttUnavailable;

export const TalkScreen = ({ talk: initial, onSave, onHome, onRename }: Props) => {
  const t = useT();
  const [talk, setTalk] = useState(initial);
  const talkRef = useRef(talk);
  talkRef.current = talk;
  /** 대화의 언어(나·상대). 대화를 만들 때 정해지고 바뀌지 않는다 */
  const lang = talk.lang;
  const whoOf = (l: Lang): 'me' | 'them' => (l === lang.me ? 'me' : 'them');
  const colorOf = (l: Lang): string => ROLE_COLOR[whoOf(l)];
  const [prefs, setPrefs] = useState<TalkPrefs>(loadTalkPrefs);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [draft, setDraft] = useState('');
  /** 녹음 중인 언어와 소리 크기(0~1, 5단계로 반올림해 다시 그리기를 줄인다) */
  const [rec, setRec] = useState<{ readonly lang: Lang; readonly level: number } | null>(null);
  /** 녹음을 보내 글자로 받아 적는 중인 쪽 */
  const [hearing, setHearing] = useState<Lang | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [show, setShow] = useState<Show | null>(null);
  const [helperOpen, setHelperOpen] = useState(false);
  const recRef = useRef<RecorderHandle | null>(null);
  const ctrls = useRef(new Set<AbortController>());
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saved = useRef(initial);
  /** 화면이 떠났는지. 마이크 권한을 묻는 동안 떠나면 그 뒤 시작된 녹음을 버린다 */
  const alive = useRef(true);
  /** 마이크를 여는 중(권한·장치 준비, 수백 ms). 그동안 두 번 눌러 녹음이 둘 시작되지 않게 막는다 */
  const starting = useRef(false);
  const [opening, setOpening] = useState(false);
  const titling = useRef(false);

  // 기록 화면에서 고친 이름이 내려오면 반영
  useEffect(() => { setTalk((t) => (t.userTitle === initial.userTitle ? t : { ...t, userTitle: initial.userTitle })); }, [initial.userTitle]);
  // 화면을 떠나면 녹음·요청을 끊고(뒤에서 비용이 들지 않게), 번역 중이던 마디는 받은 데까지 남겨 저장한다(번역문이 없으면 다시 번역 가능한 오류로)
  useEffect(() => {
    alive.current = true; // StrictMode 의 마운트 → 정리 → 마운트에서도 살아 있게
    return () => {
      alive.current = false;
      recRef.current?.cancel();
      ctrls.current.forEach((c) => c.abort());
      const last = talkRef.current;
      if (last === saved.current || last.turns.length === 0) return;
      onSave({ ...last, turns: last.turns.map((t) => (t.status !== 'translating' ? t : { ...t, status: t.ja || t.ko ? 'done' : 'error' })) });
    };
  }, [onSave]);
  // 마디가 1개 이상이고 번역 중인 것이 없을 때 저장
  useEffect(() => {
    if (talk === saved.current || talk.turns.length === 0 || talk.turns.some((t) => t.status === 'translating')) return;
    saved.current = talk;
    onSave(talk);
  }, [talk, onSave]);
  // 자동 제목(완료 2마디, 6마디). 실패해도 그 단계는 넘긴다
  useEffect(() => {
    if (titling.current || !needsTitle(talk)) return;
    titling.current = true;
    const done = talk.turns.filter((t) => t.status === 'done').length;
    void fetchTitle(contextTurns(talk.turns, talk.lang), talk.lang).catch(() => null).then((title) => {
      setTalk((t) => ({ ...t, autoTitle: title ?? t.autoTitle, titledAt: done }));
      titling.current = false;
    });
  }, [talk]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }); }, [talk.turns, hearing]);

  const changePrefs = (next: TalkPrefs) => { saveTalkPrefs(next); setPrefs(next); };
  const track = () => { const c = new AbortController(); ctrls.current.add(c); return c; };
  const patchTurn = useCallback((id: string, f: (t: TalkTurn) => TalkTurn) => setTalk((t) => ({ ...t, updatedAt: Date.now(), turns: t.turns.map((x) => (x.id === id ? f(x) : x)) })), []);
  const addTurn = (turn: TalkTurn) => setTalk((t) => ({ ...t, updatedAt: Date.now(), turns: [...t.turns, turn] }));

  const translateTurn = async (turn: TalkTurn) => {
    const ctrl = track();
    const tl = talkRef.current.lang;
    const before = contextTurns(talkRef.current.turns.filter((t) => t.id !== turn.id && t.at <= turn.at), tl);
    try {
      const result = await translate(turn.src, before, tl, (f) => patchTurn(turn.id, (x) => applyFields(x, f, tl)), ctrl.signal);
      patchTurn(turn.id, (x) => ({ ...applyFields(x, result, tl), status: 'done' }));
    } catch (e) {
      if (ctrl.signal.aborted) return;
      patchTurn(turn.id, (x) => ({ ...x, status: 'error' }));
      if (isAccessCodeError(e)) setNotice((e as Error).message);
    } finally { ctrls.current.delete(ctrl); }
  };
  const start = (turn: TalkTurn) => { addTurn(turn); void translateTurn(turn); };
  const retry = (turn: TalkTurn) => {
    const fresh: TalkTurn = { ...newTurn(turn.who, turn.via, turn.src), id: turn.id, at: turn.at };
    patchTurn(turn.id, () => fresh);
    void translateTurn(fresh);
  };

  /** 말하기 버튼(voice 는 녹음·인식 언어). 녹음 중에 다시 누르면 끝낸다(말이 끝나고 조용해져도 저절로 끝난다) */
  const speak = async (voice: Lang) => {
    if (rec) { recRef.current?.stop(); return; }
    if (hearing || starting.current) return;
    setNotice(null);
    setPicker(false);
    if (!canRecord()) { setNotice(t.talk.noRecorder); setMode('text'); return; }
    let started: Awaited<ReturnType<typeof startRecording>>;
    starting.current = true;
    setOpening(true);
    try {
      started = await startRecording((level) => {
        const step = Math.round(level * 5) / 5;
        setRec((r) => (r && r.level !== step ? { ...r, level: step } : r));
      });
    } catch {
      setNotice(t.talk.micDenied);
      return;
    } finally {
      starting.current = false;
      if (alive.current) setOpening(false);
    }
    if (!alive.current) { started.handle.cancel(); return; }
    recRef.current = started.handle;
    setRec({ lang: voice, level: 0 });
    const r = await started.done;
    recRef.current = null;
    if (!r || !alive.current) return;
    setRec(null);
    if (!r.heard) { setNotice(t.talk.nothingHeard); return; }
    const ctrl = track();
    setHearing(voice);
    try {
      const text = await transcribe(r.blob, voice, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!text) { setNotice(t.talk.notUnderstood); return; }
      start(newTurn(whoOf(voice), 'voice', text));
    } catch (e) {
      if (ctrl.signal.aborted) return;
      if (e instanceof SttUnavailableError) { setNotice(sttNotice(t.talk, e.retryAfter)); setMode('text'); }
      else setNotice(t.talk.sttFailed(e instanceof Error ? e.message : String(e)));
    } finally {
      ctrls.current.delete(ctrl);
      setHearing(null);
    }
  };

  // 글로 쓰기: 보내면 키보드를 내려 말풍선을 가리지 않게 한다
  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setNotice(null);
    inputRef.current?.blur();
    start(newTurn('me', 'text', text));
  };

  const showTurn = (turn: TalkTurn) => {
    const v = bubbleView(turn, prefs.pair, true, lang);
    const main = v.mainLang === lang.them;
    setShow({ text: v.main, lang: v.mainLang, kana: main && lang.them === 'ja' ? turn.kana : '', pron: main ? turn.pron : '' });
  };
  /** 도우미의 「말해 볼 문장」(상대 언어)을 내 말풍선으로 넣고 바로 크게 보여준다 */
  const sayFromHelper = (text: string, pron: string) => {
    addTurn({ ...withTranslation(newTurn('me', 'helper', text), lang.them, text), pron, status: 'done' });
    setHelperOpen(false);
    setShow({ text, lang: lang.them, kana: '', pron });
  };
  const setHelper = useCallback((helper: readonly HelperMsg[]) => setTalk((t) => ({ ...t, updatedAt: Date.now(), helper })), []);

  const recording = (voice: Lang) => rec?.lang === voice;
  const micButton = (voice: Lang) => {
    const v = { ...t.talk.mic[voice], color: colorOf(voice) };
    const on = recording(voice);
    const other: Lang = voice === 'ko' ? 'ja' : 'ko';
    return (
      <button type="button" className="btn" onClick={() => void speak(voice)} disabled={opening || hearing !== null || recording(other)} lang={voice} aria-pressed={on}
        style={{ position: 'relative', overflow: 'hidden', flex: 1, minHeight: 60, padding: '0 8px', gap: 8, fontSize: 16, fontWeight: 700,
          background: on ? 'var(--paper-2)' : v.color, color: on ? v.color : 'var(--paper-2)', border: on ? `3px solid ${v.color}` : '2px solid var(--ink)',
          boxShadow: on ? 'none' : '3px 3px 0 var(--ink)', transform: on ? 'translate(2px, 2px)' : undefined }}>
        {on ? <span className="blink" aria-hidden="true">●</span> : <DotGlyph name="mic" size={18} />}
        <span style={{ whiteSpace: 'nowrap' }}>{on ? v.live : v.label}</span>
        {on && <span aria-hidden="true" style={{ position: 'absolute', left: 0, bottom: 0, height: 5, width: `${Math.max(8, rec!.level * 100)}%`, background: v.color }} />}
      </button>
    );
  };
  const hasMine = talk.turns.some((t) => t.who === 'me' && t.status === 'done');

  return (
    <div style={{ height: '100dvh', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      <header style={{ flexShrink: 0, padding: 'calc(2px + max(var(--safe-top) + 8px, var(--edge-top))) 12px 8px 6px', borderBottom: '2px solid var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" className="btn btn--icon" aria-label={t.common.home} onClick={onHome}>◀</button>
        <button type="button" onClick={() => onRename(talk)} aria-label={t.talk.renameAria(talkTitle(talk))}
          style={{ flex: 1, minWidth: 0, minHeight: 44, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {talkTitle(talk)}
        </button>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button type="button" className="btn" onClick={() => setPicker((p) => !p)} aria-expanded={picker} aria-haspopup="menu" aria-label={t.talk.pairAria(t.talk.pairName[prefs.pair])}
            style={{ minHeight: 40, minWidth: 64, padding: '0 8px', gap: 4, whiteSpace: 'nowrap', boxShadow: 'none', fontFamily: 'var(--font-dot)', fontSize: 13, background: picker ? 'var(--ink)' : 'var(--paper-2)', color: picker ? 'var(--paper)' : 'var(--ink)' }}>
            {t.talk.pairLabel[prefs.pair]}<span aria-hidden="true" style={{ fontSize: 9 }}>▼</span>
          </button>
          {picker && (
            <>
              <button type="button" tabIndex={-1} aria-hidden="true" onClick={() => setPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 4, background: 'transparent', border: 0, cursor: 'default' }} />
              <div role="menu" className="frame" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 5, width: 220, boxShadow: '4px 4px 0 var(--ink)', padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="muted small" style={{ padding: '2px 6px' }}>{t.talk.pairMenuTitle}</span>
                {PAIRS.map((p) => (
                  <button key={p} type="button" role="menuitemradio" aria-checked={p === prefs.pair} onClick={() => { changePrefs({ ...prefs, pair: p }); setPicker(false); }}
                    style={{ minHeight: 40, padding: '0 8px', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', font: 'inherit', fontSize: 14, background: p === prefs.pair ? 'var(--ink)' : 'transparent', color: p === prefs.pair ? 'var(--paper)' : 'var(--ink)' }}>
                    <span>{t.talk.pairName[p]}</span>{p === 'ko-ja' && <span style={{ fontSize: 11 }}>{t.talk.pairDefault}</span>}
                  </button>
                ))}
                <div style={{ height: 2, background: 'var(--paper-dark)', margin: '2px 0' }} />
                <button type="button" role="menuitemcheckbox" aria-checked={prefs.pron} onClick={() => changePrefs({ ...prefs, pron: !prefs.pron })}
                  style={{ minHeight: 40, padding: '0 8px', border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', font: 'inherit', fontSize: 14, color: 'var(--ink)' }}>
                  <span>{t.talk.pronToggle[lang.them]}</span><span className="dot" style={{ fontSize: 13, color: prefs.pron ? 'var(--vermilion)' : 'var(--muted)' }}>{prefs.pron ? t.talk.on : t.talk.off}</span>
                </button>
              </div>
            </>
          )}
        </div>
        <button type="button" className="btn" onClick={() => { setPicker(false); setHelperOpen(true); }} aria-label={t.talk.helperAsk} title={t.talk.helperTitle}
          style={{ flexShrink: 0, width: 40, minHeight: 40, padding: 0 }}>
          <DotGlyph name="sparkle" size={20} />
        </button>
      </header>

      <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 14px 16px' }}>
        {talk.turns.length === 0 && !hearing && (
          <p className="muted" style={{ margin: '24px 4px', fontSize: 14, lineHeight: 1.65 }}>
            {t.talk.intro[lang.me]}
          </p>
        )}
        {hasMine && <p className="muted" style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 11 }}>{t.talk.tapToShow}</p>}
        {talk.turns.map((t, i) => (
          <TalkBubble key={t.id} turn={t} pair={prefs.pair} lang={lang} showPron={prefs.pron} joined={i > 0 && talk.turns[i - 1]!.who === t.who} onShow={showTurn} onRetry={retry} />
        ))}
        {hearing && (
          <div style={{ display: 'flex', justifyContent: whoOf(hearing) === 'me' ? 'flex-end' : 'flex-start', marginTop: 16 }}>
            <div style={{ padding: '8px 12px', border: `2px dashed ${colorOf(hearing)}`, background: 'var(--paper-2)', fontSize: 14, color: 'var(--body)' }}>
              {t.talk.mic[hearing].hearing}<span className="blink">▌</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, borderTop: '2px solid var(--ink)', padding: '8px 14px calc(14px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 녹음 중이면 그 언어 색으로 상태 한 줄, 아니면 안내(오류 등) */}
        <div role="status" style={{ fontSize: 12, lineHeight: 1.5, fontWeight: rec ? 600 : 400, color: rec ? colorOf(rec.lang) : 'var(--vermilion-dark)', display: rec || notice ? 'block' : 'none' }}>
          {rec ? <><span className="blink" aria-hidden="true">● </span>{t.talk.mic[rec.lang].status}</> : notice}
        </div>
        {mode === 'voice' ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn" onClick={() => setMode('text')} aria-label={t.talk.writeMode} disabled={rec !== null} style={{ width: 52, minHeight: 60, padding: 0, boxShadow: 'none' }}>
              <DotGlyph name="keyboard" size={22} />
            </button>
            {micButton(lang.me)}
            {micButton(lang.them)}
          </div>
        ) : (
          <form onSubmit={send} style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="btn" onClick={() => setMode('voice')} aria-label={t.talk.backToVoice} style={{ width: 48, minHeight: 48, padding: 0, boxShadow: 'none' }}>
              <DotGlyph name="mic" size={20} />
            </button>
            <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.talk.inputPlaceholder} aria-label={t.talk.inputAria} enterKeyHint="send" maxLength={500}
              style={{ flex: 1, minWidth: 0, minHeight: 48, padding: '0 10px', border: '2px solid var(--ink)', background: 'var(--paper-2)', fontSize: 16, fontFamily: 'inherit', color: 'var(--ink)' }} />
            <button type="submit" className="btn btn--primary" disabled={!draft.trim()} aria-label={t.talk.sendTranslate} style={{ minHeight: 48, padding: '0 16px' }}>▶</button>
          </form>
        )}
      </div>

      {show && <ShowBig text={show.text} lang={show.lang} kana={show.kana} pron={show.pron} pronLang={lang.me} onClose={() => setShow(null)} />}
      {helperOpen && <TalkHelper turns={talk.turns} lang={lang} msgs={talk.helper} onMsgs={setHelper} onSay={sayFromHelper} onClose={() => setHelperOpen(false)} />}
    </div>
  );
};
