import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageMode, Note, OcrWord, PickSource, Rate, Scan, ScanKind } from './types';
import { hasFiles } from './lib/drop';
import { analyzeImage, fetchRate } from './lib/api';
import { prepareImage } from './lib/image';
import { applyDetails, insertItem, newScanId, normalizeGroup, toMenuItem, toNote } from './lib/scan';
import { clearScans, getAccessCode, loadImageMode, loadRate, loadScanImage, loadScans, removeScan, saveImageMode, saveRate, saveScan, setAccessCode } from './lib/storage';
import { useInstallHint } from './lib/platform';
import { GateScreen } from './screens/GateScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ConfirmScreen } from './screens/ConfirmScreen';
import { ConfirmBatchScreen } from './screens/ConfirmBatchScreen';
import { BATCH_CONCURRENCY, runLimited } from './lib/batch';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { ResultScreen } from './screens/ResultScreen';

type Route = 'gate' | 'home' | 'history' | 'confirm' | 'processing' | 'result';

const emptyScan = (): Scan => ({
  id: newScanId(), batchId: null, createdAt: Date.now(), imageDataUrl: '', width: 4, height: 3, kind: 'menu', kindKnown: false, shopName: null, sheetQuad: null,
  words: [], rotation: 0, tilt: 0, notes: [], groups: null, items: [], status: 'preparing', error: null,
  timing: { ocrMs: null, firstItemMs: null, listMs: null, totalMs: null },
});

/** 이전 버전에 저장된 스캔도 열리도록 빠진 필드를 채운다 */
const upgrade = (s: Scan): Scan => ({
  ...emptyScan(), ...s, batchId: s.batchId ?? null,
  // 설명 도중 저장된 스캔은 다시 열 때 「설명 쓰는 중」이 영원히 깜빡이지 않도록 완료로 본다
  status: s.status === 'error' ? 'error' : 'done',
  words: s.words ?? [], rotation: s.rotation ?? 0, tilt: s.tilt ?? 0, kind: s.kind ?? 'menu', kindKnown: true, sheetQuad: s.sheetQuad ?? null, notes: s.notes ?? [], groups: s.groups ?? null,
  items: (s.items ?? []).map((it) => ({ ...it, price_tax_jpy: it.price_tax_jpy ?? null, group: it.group ?? null, pron_ko: it.pron_ko ?? '', desc_ko: it.desc_ko ?? '', tags: it.tags ?? [], photo_query: it.photo_query ?? it.name_ja, detailed: it.detailed ?? true })),
  timing: { ...emptyScan().timing, ...(s.timing ?? {}) },
});

const toKind = (k: string): ScanKind => (k === 'sign' || k === 'other' ? k : 'menu');

export const App = () => {
  const [route, setRoute] = useState<Route>(() => (getAccessCode() ? 'home' : 'gate'));
  const [scans, setScans] = useState<readonly Scan[]>([]);
  /** 지금 묶음의 스캔 전부(한 장이면 하나). 처리 중·결과 화면은 currentId 의 것을 보여준다 */
  const [batch, setBatch] = useState<readonly Scan[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const current = batch.find((s) => s.id === currentId) ?? null;
  /** 확인 화면에서 기다리는 사진(앨범은 여러 장) */
  const [pending, setPending] = useState<readonly File[]>([]);
  const [rate, setRate] = useState<Rate | null>(() => loadRate());
  const [mode, setMode] = useState<ImageMode>(() => loadImageMode());
  const abortRef = useRef<AbortController | null>(null);
  /** 스캔 id → 원본 파일. 사진 저장 버튼과 다시 시도에 쓴다 */
  const files = useRef(new Map<string, File>());
  const installHint = useInstallHint();

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
    loadScans().then((list) => { if (alive) setScans(list.map(upgrade)); });
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
        onMeta: (m) => {
          const notes = m.notes.map((n) => toNote(n, words)).filter((n): n is Note => n !== null);
          const listMs = Date.now() - t0;
          update((s) => {
            const next: Scan = { ...s, kind: toKind(m.kind), kindKnown: true, shopName: m.shop_name, notes, status: s.items.length > 0 ? 'detailing' : s.status, timing: { ...s.timing, listMs } };
            // 목록이 완성되면 먼저 저장해 둔다(설명이 오기 전에 홈으로 가거나 다른 사진으로 넘어가도 기록에 남게). 끝나면 다시 덮어쓴다
            if (next.items.length > 0 || next.notes.length > 0) void saveScan(next).then(setScans);
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
        if (ok) void saveScan(done).then(setScans); // 사진 모드가 준비되면 여기서 prefetchPhotos(done.items) 를 호출
        return done;
      });
    } catch (e) {
      if (ac.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      if (/초대 코드/.test(message)) { setAccessCode(null); setRoute('gate'); return; }
      update((s) => ({ ...s, status: 'error', error: message }));
    }
  }, [updateScan]);

  /** 사진 묶음을 시작한다. 사진마다 독립 스트림을 동시에(최대 BATCH_CONCURRENCY) 열고 첫 장부터 보여준다 */
  const startScans = useCallback(async (list: readonly File[]) => {
    if (list.length === 0) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const batchId = list.length > 1 ? newScanId() : null;
    const scans = list.map((): Scan => ({ ...emptyScan(), batchId }));
    scans.forEach((s, i) => files.current.set(s.id, list[i]!));
    setBatch(scans);
    setCurrentId(scans[0]!.id);
    setRoute('processing');
    await runLimited(scans.map((s, i) => () => runScan(s.id, list[i]!, ac)), BATCH_CONCURRENCY);
  }, [runScan]);

  /** 묶음 안에서 다른 사진으로. 기록에서 연 묶음은 openScan 이 사진을 전부 읽어 두므로 여기서 더 읽을 것은 없다 */
  const switchTo = useCallback((id: string) => setCurrentId(id), []);

  /** 실패한 사진 한 장만 다시 읽는다. 묶음의 다른 사진은 그대로 돌게 둔다(묶음이 이미 끝났으면 새 묶음으로) */
  const retryOne = useCallback((id: string) => {
    const f = files.current.get(id);
    const ac = abortRef.current;
    if (!f) return;
    if (!ac || ac.signal.aborted) { void startScans([f]); return; }
    updateScan(id, (s) => ({ ...emptyScan(), id: s.id, batchId: s.batchId, createdAt: s.createdAt }));
    void runScan(id, f, ac);
  }, [runScan, startScans, updateScan]);

  // 목록이 완성되면(상세는 아직이어도) 결과 화면으로 넘어간다
  useEffect(() => {
    if (route === 'processing' && (current?.status === 'detailing' || current?.status === 'done')) setRoute('result');
  }, [route, current?.status]);

  const goHome = () => { abortRef.current?.abort(); setBatch([]); setCurrentId(null); setPending([]); setRoute('home'); };
  // 앨범·붙여넣기·드롭은 확인을 거친다. 촬영은 카메라 앱이 이미 「사진 사용」을 묻는다
  const pick = (list: readonly File[], source: PickSource) => {
    if (source === 'camera') { void startScans(list); return; }
    setPending(list);
    setRoute('confirm');
  };
  const changeMode = (m: ImageMode) => { saveImageMode(m); setMode(m); };

  if (route === 'gate') return <GateScreen onEnter={() => setRoute('home')} />;
  // 결과 화면에서 띠로 실패·대기 중 사진을 고르면 처리 화면(오류·다시 시도·진행 표시)을 보여준다. route 는 그대로 두어 완료된 사진으로 돌아오면 결과가 보인다
  const showProcessing = current !== null && (route === 'processing' || (route === 'result' && (current.status === 'error' || current.status === 'preparing' || current.status === 'reading')));
  if (showProcessing && current) {
    return <ProcessingScreen scan={current} batch={batch} onSwitch={switchTo} onCancel={goHome} onPeek={() => setRoute('result')} onRetry={() => retryOne(current.id)} />;
  }
  if (route === 'result' && current) {
    // key 로 스캔마다 다시 마운트해 보기 방식·선택·주문서 상태가 사진 사이에 새지 않게 한다
    return <ResultScreen key={current.id} scan={current} batch={batch} onSwitch={switchTo} rate={rate} mode={mode} onMode={changeMode} onHome={goHome} originalFile={files.current.get(current.id) ?? null} />;
  }
  // 목록에는 사진이 없다. 결과 화면으로 가기 전에 사진 한 건만 읽는다
  // 묶음으로 읽은 스캔은 같은 묶음 전부를 띠에 올린다(사진은 띠 썸네일용으로 모두 읽음, 묶음은 최대 BATCH_MAX 장)
  const openScan = (s: Scan) => {
    const siblings = s.batchId ? scans.filter((x) => x.batchId === s.batchId) : [s];
    void Promise.all(siblings.map(async (x) => upgrade({ ...x, imageDataUrl: await loadScanImage(x) }))).then((list) => {
      setBatch(list);
      setCurrentId(s.id);
      setRoute('result');
    });
  };
  const remove = (id: string) => void removeScan(id).then(setScans);
  if (route === 'confirm' && pending.length === 1) {
    const file = pending[0]!;
    return <ConfirmScreen file={file} onConfirm={(f) => { setPending([]); void startScans([f]); }} onCancel={goHome} />;
  }
  if (route === 'confirm' && pending.length > 1) {
    return <ConfirmBatchScreen files={pending} onConfirm={(list) => { setPending([]); void startScans(list); }} onCancel={goHome} />;
  }
  if (route === 'history') {
    return <HistoryScreen scans={scans} installHint={installHint} onBack={() => setRoute('home')} onOpen={openScan} onRemove={remove} onClear={() => void clearScans().then(setScans)} />;
  }
  return (
    <HomeScreen
      scans={scans}
      installHint={installHint}
      onPick={pick}
      onShowAll={() => setRoute('history')}
      onOpen={openScan}
      onRemove={remove}
    />
  );
};
