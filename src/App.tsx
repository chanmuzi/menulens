import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageMode, Note, OcrWord, PickSource, Rate, Scan, ScanKind, Talk } from './types';
import { hasFiles } from './lib/drop';
import { analyzeImage, checkStoredCode, fetchRate } from './lib/api';
import { prepareImage } from './lib/image';
import { applyDetails, insertItem, newScanId, normalizeGroup, toMenuItem, toNote } from './lib/scan';
import { backfillThumbs, clearScans, getAccessCode, loadImageMode, loadRate, loadScanImage, loadScans, removeScans, renameScans, saveImageMode, saveRate, saveScan, setAccessCode } from './lib/storage';
import { useInstallHint } from './lib/platform';
import { GateScreen } from './screens/GateScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { CropScreen } from './screens/CropScreen';
import { ConfirmBatchScreen } from './screens/ConfirmBatchScreen';
import { BATCH_CONCURRENCY, BATCH_MAX, runLimited } from './lib/batch';
import { autoGroupTitle, groupScans, groupTitle, type ScanGroup } from './lib/history';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { ResultScreen } from './screens/ResultScreen';
import { LeaveDialog } from './screens/LeaveDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { RenameDialog } from './components/RenameDialog';
import { TalkScreen } from './screens/TalkScreen';
import { loadTalks, removeTalk, saveTalk } from './lib/talkStore';
import { newTalk, talkTitle } from './lib/talk';
import type { HomeTab } from './lib/storage';

type Route = 'gate' | 'home' | 'history' | 'confirm' | 'processing' | 'result' | 'talk';

const emptyScan = (): Scan => ({
  id: newScanId(), batchId: null, createdAt: Date.now(), imageDataUrl: '', width: 4, height: 3, kind: 'menu', kindKnown: false, shopName: null, autoTitle: null, userTitle: null, thumb: null, sheetQuad: null,
  words: [], rotation: 0, tilt: 0, notes: [], summary: null, groups: null, items: [], status: 'preparing', error: null,
  timing: { ocrMs: null, firstItemMs: null, listMs: null, totalMs: null },
});

/** 이전 버전에 저장된 스캔도 열리도록 빠진 필드를 채운다 */
const upgrade = (s: Scan): Scan => ({
  ...emptyScan(), ...s, batchId: s.batchId ?? null,
  // 설명 도중 저장된 스캔은 다시 열 때 「설명 쓰는 중」이 영원히 깜빡이지 않도록 완료로 본다
  status: s.status === 'error' ? 'error' : 'done',
  words: s.words ?? [], rotation: s.rotation ?? 0, tilt: s.tilt ?? 0, kind: s.kind ?? 'menu', kindKnown: true, sheetQuad: s.sheetQuad ?? null, notes: s.notes ?? [], summary: s.summary ?? null, groups: s.groups ?? null,
  items: (s.items ?? []).map((it) => ({ ...it, price_tax_jpy: it.price_tax_jpy ?? null, group: it.group ?? null, pron_ko: it.pron_ko ?? '', desc_ko: it.desc_ko ?? '', tags: it.tags ?? [], photo_query: it.photo_query ?? it.name_ja, detailed: it.detailed ?? true })),
  timing: { ...emptyScan().timing, ...(s.timing ?? {}) },
});

const toKind = (k: string): ScanKind => (k === 'sign' || k === 'other' ? k : 'menu');

export const App = () => {
  const [route, setRoute] = useState<Route>(() => (getAccessCode() ? 'home' : 'gate'));
  const [scans, setRawScans] = useState<readonly Scan[]>([]);
  /** 저장소에서 온 목록은 언제나 upgrade 를 거쳐 넣는다(옛 기록에 빠진 kind·notes 등을 채워야 목록·제목이 깨지지 않는다) */
  const setScans = useCallback((list: readonly Scan[]) => setRawScans(list.map(upgrade)), []);
  /** 지금 묶음의 스캔 전부(한 장이면 하나). 처리 중·결과 화면은 currentId 의 것을 보여준다 */
  const [batch, setBatch] = useState<readonly Scan[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = batch.find((s) => s.id === currentId) ?? null;
  /** 모음 화면에서 기다리는 사진. 어느 경로로 들어오든(촬영·앨범·붙여넣기·드롭, 한 장이든 여러 장이든) 모음 화면을 거친다 */
  const [pending, setPending] = useState<readonly File[]>([]);
  /** 홈으로 나가려는데 읽는 중인 사진이 있어 확인을 받는 중 */
  const [leaving, setLeaving] = useState(false);
  /** 모음 화면에서 자르러 온 사진의 번호(없으면 null). 잘라서 그 자리에 넣고 모음으로 돌아간다. 미리 읽던 사진이었으면 자른 뒤 다시 미리 읽는다 */
  const [cropAt, setCropAt] = useState<{ readonly index: number; readonly wasReading: boolean } | null>(null);
  /** 상한 때문에 뺀 장수(모음 화면 안내용) */
  const [dropped, setDropped] = useState(0);
  const [rate, setRate] = useState<Rate | null>(() => loadRate());
  const [mode, setMode] = useState<ImageMode>(() => loadImageMode());
  /** 지우기 확인 중인 기록(최근·전체 목록 공용) */
  const [removing, setRemoving] = useState<ScanGroup | null>(null);
  /** 이름 고치는 중인 기록(목록·결과 화면 공용) */
  const [renaming, setRenaming] = useState<ScanGroup | null>(null);
  /** 스캔 id → 그 사진의 중단 컨트롤러. 사진마다 따로 두어 한 장을 더 붙이거나 빼도 나머지는 계속 돈다 */
  const ctrls = useRef(new Map<string, AbortController>());
  /** 아직 「N장 분석하기」를 누르지 않은 미리 읽기 스캔 id. 확정 전에는 기록에 저장하지 않는다 */
  const draft = useRef(new Set<string>());
  /** 스캔 id → 원본 파일. 사진 저장 버튼과 다시 시도에 쓴다 */
  const files = useRef(new Map<string, File>());
  const installHint = useInstallHint();
  /** 대화 통역: 저장된 대화 목록, 지금 열린 대화, 기록 화면 탭, 지우기·이름 고치기 중인 대화 */
  const [talks, setTalks] = useState<readonly Talk[]>([]);
  const [currentTalk, setCurrentTalk] = useState<Talk | null>(null);
  const [historyTab, setHistoryTab] = useState<HomeTab>('menu');
  const [removingTalk, setRemovingTalk] = useState<Talk | null>(null);
  const [renamingTalk, setRenamingTalk] = useState<Talk | null>(null);
  const persistTalk = useCallback((t: Talk) => { void saveTalk(t).then(setTalks); }, []);

  useEffect(() => {
    let alive = true;
    void loadTalks().then((list) => { if (alive) setTalks(list); });
    return () => { alive = false; };
  }, []);

  // 어느 화면에서든 파일을 끌어다 놓아도 브라우저가 그 파일로 이동하지 않게 막는다 (홈 화면은 자기 리스너에서 받아 처리)
  useEffect(() => {
    const block = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    document.addEventListener('dragover', block);
    document.addEventListener('drop', block);
    return () => { document.removeEventListener('dragover', block); document.removeEventListener('drop', block); };
  }, []);

  // 기록은 IndexedDB 에서 비동기로 온다 (첫 렌더는 빈 목록)
  useEffect(() => {
    let alive = true;
    loadScans().then((list) => {
      if (!alive) return;
      setScans(list);
      // 썸네일이 없는 옛 기록은 저장된 사진으로 뒤에서 채운다(목록은 그동안 도트 아이콘)
      if (list.some((s) => !s.thumb)) void backfillThumbs(list).then((next) => { if (alive) setScans(next); });
    });
    return () => { alive = false; };
  }, []);

  // 앱을 열 때 저장된 초대 코드를 한 번 확인한다. 코드가 바뀌었으면(서버가 401) 분석을 시도하기 전에 게이트로 돌린다(LLM 호출 없음)
  useEffect(() => {
    const code = getAccessCode();
    if (!code) return;
    let alive = true;
    void checkStoredCode(code).then((r) => { if (alive && r === 'invalid') { setAccessCode(null); setRoute('gate'); } });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (rate || route === 'gate') return;
    fetchRate().then((r) => { saveRate(r); setRate(r); }).catch(() => { /* 환율 없이도 동작 */ });
  }, [rate, route]);

  const updateScan = useCallback((id: string, patch: (s: Scan) => Scan) => {
    setBatch((b) => b.map((s) => (s.id === id ? patch(s) : s)));
  }, []);

  /** 사진 한 장을 끝까지 읽는다. 묶음의 다른 사진과 독립적으로 돌고, 끝나면 그 스캔만 저장한다 */
  const runScan = useCallback(async (id: string, file: File, ac: AbortController) => {
    const update = (patch: (s: Scan) => Scan) => updateScan(id, patch);
    const t0 = Date.now();
    try {
      const img = await prepareImage(file);
      if (ac.signal.aborted) return;
      update((s) => ({ ...s, imageDataUrl: img.dataUrl, width: img.width, height: img.height, status: 'reading' }));
      let words: readonly OcrWord[] = [];
      let firstItemMs: number | null = null;
      // 스트리밍 중 문구(안내문 문단). 묶음끼리 도착 순서가 섞이므로 key(묶음:순번) 순으로 정렬해 보여준다. meta 가 오면 최종본으로 바뀐다
      let streamed: ReadonlyArray<readonly [string, Note]> = [];
      const keyOrder = (k: string): [number, number] => { const [c, n] = k.split(':').map(Number); return [c ?? 0, n ?? 0]; };
      await analyzeImage(img.base64, img.mediaType, {
        signal: ac.signal,
        onOcr: (r) => {
          words = r.used ? r.words : [];
          update((s) => ({ ...s, words, rotation: r.used ? r.rotation : 0, tilt: r.used ? r.tilt : 0, timing: { ...s.timing, ocrMs: r.ms } }));
        },
        onMode: () => update((s) => ({ ...s, status: 'streaming' })),
        onKind: (k) => update((s) => ({ ...s, kind: toKind(k), kindKnown: true })),
        onItem: (key, raw) => {
          const item = toMenuItem(raw, key, words);
          if (!item) return;
          if (firstItemMs === null) firstItemMs = Date.now() - t0;
          const first = firstItemMs;
          update((s) => ({ ...s, items: insertItem(s.items, item), timing: { ...s.timing, firstItemMs: first } }));
        },
        onNote: (key, raw) => {
          const note = toNote(raw, words);
          if (!note) return;
          const now = Date.now() - t0;
          streamed = [...streamed, [key, note] as const].sort((x, y) => { const [a1, a2] = keyOrder(x[0]), [b1, b2] = keyOrder(y[0]); return a1 - b1 || a2 - b2; });
          const notes = streamed.map(([, n]) => n);
          // 안내문은 첫 문단부터 결과 화면을 열어 덮개가 차례로 뜨게 한다(메뉴판은 항목이 기준이라 그대로)
          // 「첫 항목」 시간은 안내문만 문단 기준(메뉴판은 notes 가 items 보다 먼저 나와 항목 기준을 지킨다)
          update((s) => ({ ...s, notes, status: s.kind !== 'menu' && s.status === 'streaming' ? 'detailing' : s.status, timing: { ...s.timing, firstItemMs: s.kind !== 'menu' ? (s.timing.firstItemMs ?? now) : s.timing.firstItemMs } }));
        },
        onSummary: (summary) => update((s) => ({ ...s, summary })),
        onMeta: (m) => {
          const finalNotes = m.notes.map((n) => toNote(n, words)).filter((n): n is Note => n !== null);
          // 서버 최종본이 스트리밍으로 받은 것보다 짧으면(파싱 실패한 묶음) 이미 그린 문단을 지우지 않는다
          const notes = finalNotes.length >= streamed.length ? finalNotes : streamed.map(([, n]) => n);
          const listMs = Date.now() - t0;
          update((s) => {
            const next: Scan = { ...s, kind: toKind(m.kind), kindKnown: true, shopName: m.shop_name, autoTitle: m.title, notes, status: s.items.length > 0 ? 'detailing' : s.status, timing: { ...s.timing, listMs } };
            // 목록이 완성되면 먼저 저장해 둔다(설명이 오기 전에 홈으로 가거나 다른 사진으로 넘어가도 기록에 남게). 끝나면 다시 덮어쓴다
            if ((next.items.length > 0 || next.notes.length > 0) && !draft.current.has(id)) void saveScan(next).then(setScans);
            return next;
          });
        },
        onDetails: (details) => update((s) => ({ ...s, items: applyDetails(s.items, details) })),
        onGroups: (groups) => update((s) => ({ ...s, groups: groups.flatMap((g) => { const name = normalizeGroup(g.name); return name ? [{ ...g, name }] : []; }) })),
      });
      if (ac.signal.aborted) return;
      const totalMs = Date.now() - t0;
      update((s) => {
        const ok = s.items.length > 0 || s.notes.length > 0;
        const done: Scan = { ...s, status: ok ? 'done' : 'error', error: ok ? null : '글자를 찾지 못했어요. 더 가까이, 밝게 찍어 주세요.', timing: { ...s.timing, totalMs } };
        if (ok && !draft.current.has(id)) void saveScan(done).then(setScans); // 사진 모드가 준비되면 여기서 prefetchPhotos(done.items) 를 호출
        return done;
      });
    } catch (e) {
      if (ac.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      if (/초대 코드/.test(message)) { setAccessCode(null); setRoute('gate'); return; }
      update((s) => ({ ...s, status: 'error', error: message }));
    }
  }, [updateScan]);

  /** 한 장의 스캔 자리를 만들고 파일·컨트롤러를 등록한다. createdAt 은 묶음 안 순서가 기록에서도 유지되게 밀리초를 더한다 */
  const newScan = useCallback((file: File, batchId: string | null, order: number): Scan => {
    const s: Scan = { ...emptyScan(), batchId, createdAt: Date.now() + order };
    files.current.set(s.id, file);
    ctrls.current.set(s.id, new AbortController());
    return s;
  }, []);
  const abortScan = useCallback((id: string) => { ctrls.current.get(id)?.abort(); ctrls.current.delete(id); draft.current.delete(id); }, []);
  const abortAll = useCallback(() => { ctrls.current.forEach((c) => c.abort()); ctrls.current.clear(); draft.current.clear(); }, []);
  const start = useCallback((s: Scan) => runScan(s.id, files.current.get(s.id)!, ctrls.current.get(s.id)!), [runScan]);

  /** 사진 묶음을 시작한다. 모음 화면에서 미리 읽기 시작한 사진(batch 에 이미 있는 것)은 그대로 이어 가고(실패한 것은 새로), 빠진 사진은 중단한다.
   *  나머지는 사진마다 독립 스트림을 동시에(최대 BATCH_CONCURRENCY) 열고 첫 장부터 보여준다 */
  const startScans = useCallback(async (input: readonly File[]) => {
    const list = input.slice(0, BATCH_MAX);
    if (list.length === 0) return;
    const batchId = list.length > 1 ? newScanId() : null;
    const reuse = new Map<File, string>();
    for (const s of batch) { const f = files.current.get(s.id); if (f && list.includes(f) && s.status !== 'error') reuse.set(f, s.id); else abortScan(s.id); }
    const fresh: Scan[] = [];
    const plan = list.map((f, i) => {
      const keptId = reuse.get(f);
      if (keptId) { draft.current.delete(keptId); return { id: keptId, order: i, scan: null }; }
      const s = newScan(f, batchId, i);
      fresh.push(s);
      return { id: s.id, order: i, scan: s };
    });
    const at = Date.now();
    // 함수형 갱신: 미리 읽던 스캔의 스트림 갱신이 그 사이 큐에 있어도 잃지 않는다
    setBatch((b) => plan.map(({ id, order, scan }) => {
      const kept = scan ?? b.find((x) => x.id === id);
      const next: Scan = { ...(kept ?? emptyScan()), id, batchId, createdAt: at + order };
      // 확정 전에 이미 다 읽은 스캔은 저장을 미뤄 두었으니 지금 묶음 id 와 순서로 저장한다
      if (!scan && (next.status === 'done' || next.status === 'detailing')) void saveScan(next).then(setScans);
      return next;
    }));
    setCurrentId(plan[0]!.id);
    setRoute('processing');
    await runLimited(fresh.map((s) => () => start(s)), BATCH_CONCURRENCY);
  }, [batch, abortScan, newScan, start]);

  /** 모음 화면에 있는 동안 첫 장을 뒤에서 미리 읽기 시작한다(화면은 그대로). 「N장 분석하기」가 이 스캔을 이어받는다 */
  const prewarm = useCallback((file: File) => {
    const s = newScan(file, null, 0);
    draft.current.add(s.id);
    setBatch([s]);
    setCurrentId(s.id);
    void start(s);
  }, [newScan, start]);

  /** 결과·처리 중 화면에서 사진을 더 붙인다(기록에서 연 묶음도 같다). 묶음 id 가 없던 한 장짜리는 묶음으로 승격해 저장한다 */
  const addScans = useCallback((input: readonly File[]) => {
    const list = input.slice(0, Math.max(0, BATCH_MAX - batch.length));
    if (list.length === 0 || batch.length === 0) return;
    const batchId = batch[0]!.batchId ?? newScanId();
    const last = batch[batch.length - 1]!.createdAt;
    const fresh = list.map((f, i): Scan => ({ ...newScan(f, batchId, 0), createdAt: last + 1 + i }));
    setBatch((b) => {
      const promoted = b.map((s) => (s.batchId === batchId ? s : { ...s, batchId }));
      promoted.forEach((s, i) => { if (s !== b[i] && (s.status === 'done' || s.status === 'detailing')) void saveScan(s).then(setScans); });
      return [...promoted, ...fresh];
    });
    void runLimited(fresh.map((s) => () => start(s)), BATCH_CONCURRENCY);
  }, [batch, newScan, start]);

  /** 묶음 안에서 다른 사진으로. 기록에서 연 묶음은 openScan 이 사진을 전부 읽어 두므로 여기서 더 읽을 것은 없다 */
  const switchTo = useCallback((id: string) => setCurrentId(id), []);

  /** 실패한 사진 한 장만 다시 읽는다. 묶음의 다른 사진은 그대로 돌게 둔다 */
  const retryOne = useCallback((id: string) => {
    const f = files.current.get(id);
    if (!f) return;
    abortScan(id);
    ctrls.current.set(id, new AbortController());
    updateScan(id, (s) => ({ ...emptyScan(), id: s.id, batchId: s.batchId, createdAt: s.createdAt }));
    void runScan(id, f, ctrls.current.get(id)!);
  }, [abortScan, runScan, updateScan]);

  // 목록이 완성되면(상세는 아직이어도) 결과 화면으로 넘어간다
  useEffect(() => {
    if (route === 'processing' && (current?.status === 'detailing' || current?.status === 'done')) setRoute('result');
  }, [route, current?.status]);

  const goHome = () => { abortAll(); setBatch([]); setCurrentId(null); setPending([]); setLeaving(false); setRoute('home'); };
  /** 아직 읽는 중인(돈이 드는 호출이 열려 있는) 사진 수. 기록에서 연 묶음은 전부 끝난 상태라 0 */
  // 모음 화면의 미리 읽기는 사용자가 시작한 읽기가 아니고 저장되지도 않으니 묻지 않는다(나가면 그냥 끊는다)
  const busy = route === 'confirm' ? 0 : batch.filter((s) => s.status !== 'done' && s.status !== 'error').length;
  /** 홈으로: 읽는 중이면 중단할지 먼저 묻는다(뒤에서 계속 돌며 비용이 들지 않게) */
  const requestHome = () => { if (busy > 0) setLeaving(true); else goHome(); };
  // 어느 경로든 모음 화면으로(한 장이어도 더 찍기·앨범 추가·자르기가 가능하게). 촬영은 그동안 첫 장을 미리 읽는다
  const pick = (input: readonly File[], source: PickSource) => {
    const list = input.slice(0, BATCH_MAX);
    setDropped(input.length - list.length);
    setPending(list);
    setCropAt(null);
    setRoute('confirm');
    if (source === 'camera') prewarm(list[0]!);
  };
  /** 미리 읽는 중인 첫 장 파일(모음 화면 표시용) */
  const reading = batch.length === 1 && route === 'confirm' ? (files.current.get(batch[0]!.id) ?? null) : null;
  const changeMode = (m: ImageMode) => { saveImageMode(m); setMode(m); };

  if (route === 'gate') return <GateScreen onEnter={() => setRoute('home')} />;
  /** 대화 이름 고치기: 저장된 최신본에 반영하고(아직 저장 전이면 화면 것만), 열린 대화에도 내려보낸다 */
  const renameTalk = (t: Talk, userTitle: string | null) => {
    const latest = talks.find((x) => x.id === t.id);
    if (latest) persistTalk({ ...latest, userTitle });
    setCurrentTalk((c) => (c && c.id === t.id ? { ...c, userTitle } : c));
    setRenamingTalk(null);
  };
  const talkRenameDialog = renamingTalk && (
    <RenameDialog current={talkTitle(renamingTalk)} auto={talkTitle({ ...renamingTalk, userTitle: null })} edited={!!renamingTalk.userTitle}
      onCancel={() => setRenamingTalk(null)} onSave={(name) => renameTalk(renamingTalk, name)} />
  );
  const talkRemoveDialog = removingTalk && (
    <ConfirmDialog title="이 대화를 지울까요?" confirmLabel="지우기" body={`「${talkTitle(removingTalk)}」 대화를 지우면 되돌릴 수 없어요.`}
      onCancel={() => setRemovingTalk(null)} onConfirm={() => { void removeTalk(removingTalk.id).then(setTalks); setRemovingTalk(null); }} />
  );
  const openTalk = (t: Talk) => { setCurrentTalk(t); setRoute('talk'); };
  if (route === 'talk' && currentTalk) {
    // 이름 고치기 대상은 화면이 들고 있는 최신본(제목·마디가 App 것보다 앞설 수 있다)
    return <><TalkScreen key={currentTalk.id} talk={currentTalk} onSave={persistTalk} onHome={() => { setCurrentTalk(null); setRoute('home'); }} onRename={setRenamingTalk} />{talkRenameDialog}</>;
  }
  const leaveDialog = leaving && <LeaveDialog busy={busy} detailingOnly={batch.every((s) => s.status === 'detailing' || s.status === 'done' || s.status === 'error')} onStay={() => setLeaving(false)} onLeave={goHome} />;
  /** 이름 고치기: 기록과 지금 열린 묶음을 함께 바꾼다(열린 묶음이 나중에 다시 저장돼도 이름이 남게) */
  const rename = (g: ScanGroup, userTitle: string | null) => {
    const ids = g.scans.map((s) => s.id);
    setBatch((b) => b.map((s) => (ids.includes(s.id) ? { ...s, userTitle } : s)));
    void renameScans(ids, userTitle).then(setScans);
    setRenaming(null);
  };
  const renameDialog = renaming && (
    <RenameDialog current={groupTitle(renaming)} auto={autoGroupTitle(renaming)} edited={renaming.scans.some((s) => s.userTitle)}
      onCancel={() => setRenaming(null)} onSave={(name) => rename(renaming, name)} />
  );
  // 결과 화면에서 띠로 실패·대기 중 사진을 고르면 처리 화면(오류·다시 시도·진행 표시)을 보여준다. route 는 그대로 두어 완료된 사진으로 돌아오면 결과가 보인다
  const showProcessing = current !== null && (route === 'processing' || (route === 'result' && (current.status === 'error' || current.status === 'preparing' || current.status === 'reading')));
  if (showProcessing && current) {
    return <><ProcessingScreen scan={current} batch={batch} onSwitch={switchTo} onAdd={addScans} onCancel={requestHome} onPeek={() => setRoute('result')} onRetry={() => retryOne(current.id)} />{leaveDialog}</>;
  }
  if (route === 'result' && current) {
    // key 로 스캔마다 다시 마운트해 보기 방식·선택·주문서 상태가 사진 사이에 새지 않게 한다
    const group = groupScans(batch)[0]!;
    return <><ResultScreen key={current.id} scan={current} batch={batch} title={groupTitle(group)} onRename={() => setRenaming(group)} onSwitch={switchTo} onAdd={addScans} rate={rate} mode={mode} onMode={changeMode} onHome={requestHome} originalFiles={batch.map((s) => files.current.get(s.id) ?? null)} />{leaveDialog}{renameDialog}</>;
  }
  // 목록에는 사진이 없다. 결과 화면으로 가기 전에 사진 한 건만 읽는다
  // 묶음으로 읽은 스캔은 같은 묶음 전부를 찍은 순서로 띠에 올린다(사진은 띠 썸네일용으로 모두 읽음, 묶음은 최대 BATCH_MAX 장)
  const openScan = (g: ScanGroup) => {
    void Promise.all(g.scans.map(async (x) => upgrade({ ...x, imageDataUrl: await loadScanImage(x) }))).then((list) => {
      setBatch(list);
      setCurrentId(g.scans[0]!.id);
      setRoute('result');
    });
  };
  /** 묶음이면 그 안의 사진 전부를 지운다 */
  const remove = (g: ScanGroup) => void removeScans(g.scans.map((s) => s.id)).then(setScans);
  // 목록의 「지우기」는 바로 지우지 않고 확인을 받는다(되돌릴 수 없다)
  const removeDialog = removing && (
    <ConfirmDialog title="이 기록을 지울까요?" confirmLabel="지우기"
      body={`「${groupTitle(removing)}」${removing.scans.length > 1 ? ` 사진 ${removing.scans.length}장 묶음` : ' 기록'}을 지우면 되돌릴 수 없어요.`}
      onCancel={() => setRemoving(null)} onConfirm={() => { remove(removing); setRemoving(null); }} />
  );
  if (route === 'confirm' && cropAt && pending[cropAt.index]) {
    // 모음에서 한 장 자르기: 잘라서 그 자리에 바꿔 넣는다. 영역을 안 바꿨으면 원본 그대로
    const back = () => setCropAt(null);
    const applyCrop = (f: File) => {
      const original = pending[cropAt.index];
      setPending((list) => list.map((x, i) => (i === cropAt.index ? f : x)));
      // 실제로 잘라서 파일이 바뀐 경우에만 원본 미리 읽기를 버리고 잘린 사진으로 다시 시작한다(그대로 쓰기·취소는 이어 간다)
      if (cropAt.wasReading && f !== original) { if (batch[0]) abortScan(batch[0].id); prewarm(f); }
      back();
    };
    return <CropScreen file={pending[cropAt.index]!} onConfirm={applyCrop} onCancel={back} />;
  }
  if (route === 'confirm' && pending.length > 0) {
    // 미리 읽던 첫 장을 모음에서 빼면 그 읽기도 멈춘다
    const change = (list: readonly File[]) => { setPending(list); if (reading && !list.includes(reading)) { abortScan(batch[0]!.id); setBatch([]); setCurrentId(null); } };
    // 자르는 동안에도 미리 읽기는 계속 돈다(들어갔다 그냥 나오면 그대로 이어 받는다)
    const crop = (index: number) => setCropAt({ index, wasReading: reading !== null && reading === pending[index] });
    return <><ConfirmBatchScreen files={pending} dropped={dropped} onChange={change} reading={reading} onConfirm={(list) => { setPending([]); void startScans(list); }} onCrop={crop} onCancel={requestHome} />{leaveDialog}</>;
  }
  if (route === 'history') {
    return (
      <>
        <HistoryScreen scans={scans} installHint={installHint} onBack={() => setRoute('home')} onOpen={openScan} onRename={setRenaming} onRemove={setRemoving} onClear={() => void clearScans().then(setScans)}
          tab={historyTab} onTab={setHistoryTab} talks={talks} onOpenTalk={openTalk} onRenameTalk={setRenamingTalk} onRemoveTalk={setRemovingTalk} />
        {removeDialog}{renameDialog}{talkRemoveDialog}{talkRenameDialog}
      </>
    );
  }
  return (
    <>
      <HomeScreen
        scans={scans}
        installHint={installHint}
        onPick={pick}
        onShowAll={() => { setHistoryTab('menu'); setRoute('history'); }}
        onOpen={openScan}
        onRename={setRenaming}
        onRemove={setRemoving}
        talks={talks}
        onNewTalk={() => openTalk(newTalk())}
        onOpenTalk={openTalk}
        onRenameTalk={setRenamingTalk}
        onRemoveTalk={setRemovingTalk}
        onShowAllTalks={() => { setHistoryTab('talk'); setRoute('history'); }}
      />
      {removeDialog}
      {renameDialog}
      {talkRemoveDialog}
      {talkRenameDialog}
    </>
  );
};
