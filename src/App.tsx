import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageMode, Note, OcrWord, PickSource, Rate, Scan, ScanKind } from './types';
import { hasFiles } from './lib/drop';
import { analyzeImage, fetchRate } from './lib/api';
import { prepareImage } from './lib/image';
import { applyDetails, insertItem, newScanId, toMenuItem, toNote } from './lib/scan';
import { clearScans, getAccessCode, loadImageMode, loadRate, loadScanImage, loadScans, removeScan, saveImageMode, saveRate, saveScan, setAccessCode } from './lib/storage';
import { useInstallHint } from './lib/platform';
import { GateScreen } from './screens/GateScreen';
import { HomeScreen } from './screens/HomeScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { ConfirmScreen } from './screens/ConfirmScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { ResultScreen } from './screens/ResultScreen';

type Route = 'gate' | 'home' | 'history' | 'confirm' | 'processing' | 'result';

const emptyScan = (): Scan => ({
  id: newScanId(), createdAt: Date.now(), imageDataUrl: '', width: 4, height: 3, kind: 'menu', kindKnown: false, shopName: null, sheetQuad: null,
  words: [], rotation: 0, tilt: 0, notes: [], items: [], status: 'preparing', error: null,
  timing: { ocrMs: null, firstItemMs: null, listMs: null, totalMs: null },
});

/** 이전 버전에 저장된 스캔도 열리도록 빠진 필드를 채운다 */
const upgrade = (s: Scan): Scan => ({
  ...emptyScan(), ...s,
  words: s.words ?? [], rotation: s.rotation ?? 0, tilt: s.tilt ?? 0, kind: s.kind ?? 'menu', kindKnown: true, sheetQuad: s.sheetQuad ?? null, notes: s.notes ?? [],
  items: (s.items ?? []).map((it) => ({ ...it, price_tax_jpy: it.price_tax_jpy ?? null, pron_ko: it.pron_ko ?? '', desc_ko: it.desc_ko ?? '', tags: it.tags ?? [], photo_query: it.photo_query ?? it.name_ja, detailed: it.detailed ?? true })),
  timing: { ...emptyScan().timing, ...(s.timing ?? {}) },
});

const toKind = (k: string): ScanKind => (k === 'sign' || k === 'other' ? k : 'menu');

export const App = () => {
  const [route, setRoute] = useState<Route>(() => (getAccessCode() ? 'home' : 'gate'));
  const [scans, setScans] = useState<readonly Scan[]>([]);
  const [current, setCurrent] = useState<Scan | null>(null);
  /** 확인 화면에서 기다리는 사진 */
  const [pending, setPending] = useState<File | null>(null);
  const [rate, setRate] = useState<Rate | null>(() => loadRate());
  const [mode, setMode] = useState<ImageMode>(() => loadImageMode());
  const abortRef = useRef<AbortController | null>(null);
  const lastFile = useRef<File | null>(null);
  const lastScanId = useRef<string | null>(null);
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

  const update = useCallback((patch: (s: Scan) => Scan) => {
    setCurrent((s) => (s ? patch(s) : s));
  }, []);

  const startScan = useCallback(async (file: File) => {
    lastFile.current = file;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const fresh = emptyScan();
    lastScanId.current = fresh.id;
    setCurrent(fresh);
    setRoute('processing');
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
          update((s) => ({ ...s, kind: toKind(m.kind), kindKnown: true, shopName: m.shop_name, notes, status: s.items.length > 0 ? 'detailing' : s.status, timing: { ...s.timing, listMs } }));
        },
        onDetails: (details) => update((s) => ({ ...s, items: applyDetails(s.items, details) })),
      });
      if (ac.signal.aborted) return;
      const totalMs = Date.now() - t0;
      setCurrent((s) => {
        if (!s) return s;
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
  }, [update]);

  // 목록이 완성되면(상세는 아직이어도) 결과 화면으로 넘어간다
  useEffect(() => {
    if (route === 'processing' && (current?.status === 'detailing' || current?.status === 'done')) setRoute('result');
  }, [route, current?.status]);

  const goHome = () => { abortRef.current?.abort(); setCurrent(null); setPending(null); setRoute('home'); };
  // 앨범·붙여넣기·드롭은 확인을 거친다. 촬영은 카메라 앱이 이미 「사진 사용」을 묻는다
  const pick = (file: File, source: PickSource) => {
    if (source === 'camera') { void startScan(file); return; }
    setPending(file);
    setRoute('confirm');
  };
  const changeMode = (m: ImageMode) => { saveImageMode(m); setMode(m); };

  if (route === 'gate') return <GateScreen onEnter={() => setRoute('home')} />;
  if (route === 'processing' && current) {
    return <ProcessingScreen scan={current} onCancel={goHome} onPeek={() => setRoute('result')} onRetry={() => { if (lastFile.current) void startScan(lastFile.current); }} />;
  }
  if (route === 'result' && current) {
    return <ResultScreen scan={current} rate={rate} mode={mode} onMode={changeMode} onHome={goHome} originalFile={lastFile.current && lastScanId.current === current.id ? lastFile.current : null} />;
  }
  // 목록에는 사진이 없다. 결과 화면으로 가기 전에 사진 한 건만 읽는다
  const openScan = (s: Scan) => {
    void loadScanImage(s).then((imageDataUrl) => { setCurrent(upgrade({ ...s, imageDataUrl })); setRoute('result'); });
  };
  const remove = (id: string) => void removeScan(id).then(setScans);
  if (route === 'confirm' && pending) {
    const file = pending;
    return <ConfirmScreen file={file} onConfirm={(f) => { setPending(null); void startScan(f); }} onCancel={goHome} />;
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
