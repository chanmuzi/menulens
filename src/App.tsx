import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageMode, MenuItem, OcrWord, Rate, Scan } from './types';
import { analyzeImage, fetchRate } from './lib/api';
import { prepareImage } from './lib/image';
import { createItemParser, extractKind, extractQuadRaw, extractShopName } from './lib/streamItems';
import { newScanId, toMenuItem, toQuad } from './lib/scan';
import { getAccessCode, loadImageMode, loadRate, loadScans, removeScan, saveImageMode, saveRate, saveScan, setAccessCode } from './lib/storage';
import { GateScreen } from './screens/GateScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { ResultScreen } from './screens/ResultScreen';

type Route = 'gate' | 'home' | 'processing' | 'result';

const emptyScan = (): Scan => ({
  id: newScanId(), createdAt: Date.now(), imageDataUrl: '', width: 4, height: 3, kind: 'menu', shopName: null, sheetQuad: null,
  words: [], rotation: 0, tilt: 0, items: [], status: 'preparing', error: null, timing: { ocrMs: null, firstItemMs: null, totalMs: null },
});

/** 이전 버전에 저장된 스캔도 열리도록 빠진 필드를 채운다 */
const upgrade = (s: Scan): Scan => ({
  ...emptyScan(), ...s,
  words: s.words ?? [], rotation: s.rotation ?? 0, tilt: s.tilt ?? 0, kind: s.kind ?? 'menu', sheetQuad: s.sheetQuad ?? null,
  timing: s.timing ?? { ocrMs: null, firstItemMs: null, totalMs: null },
});

export const App = () => {
  const [route, setRoute] = useState<Route>(() => (getAccessCode() ? 'home' : 'gate'));
  const [scans, setScans] = useState<readonly Scan[]>(() => loadScans().map(upgrade));
  const [current, setCurrent] = useState<Scan | null>(null);
  const [rate, setRate] = useState<Rate | null>(() => loadRate());
  const [mode, setMode] = useState<ImageMode>(() => loadImageMode());
  const abortRef = useRef<AbortController | null>(null);
  const lastFile = useRef<File | null>(null);

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
    setCurrent(emptyScan());
    setRoute('processing');
    const t0 = Date.now();
    try {
      const img = await prepareImage(file);
      if (ac.signal.aborted) return;
      update((s) => ({ ...s, imageDataUrl: img.dataUrl, width: img.width, height: img.height, status: 'reading' }));
      const parser = createItemParser();
      let words: readonly OcrWord[] = [];
      let count = 0;
      let quadSeen = false;
      let kindSeen = false;
      let firstItemMs: number | null = null;
      await analyzeImage(img.base64, img.mediaType, {
        signal: ac.signal,
        onOcr: (r) => {
          words = r.used ? r.words : [];
          update((s) => ({ ...s, words, rotation: r.used ? r.rotation : 0, tilt: r.used ? r.tilt : 0, timing: { ...s.timing, ocrMs: r.ms } }));
        },
        onMode: () => update((s) => ({ ...s, status: 'streaming' })),
        onText: (chunk) => {
          const items = parser.push(chunk).map((raw) => toMenuItem(raw, count++, words)).filter((x): x is MenuItem => x !== null);
          if (!kindSeen) { const k = extractKind(parser.text()); if (k) { kindSeen = true; update((s) => ({ ...s, kind: k })); } }
          if (!quadSeen) {
            const raw = extractQuadRaw(parser.text());
            if (raw !== undefined) { quadSeen = true; const quad = toQuad(raw); if (quad) update((s) => ({ ...s, sheetQuad: quad })); }
          }
          if (items.length > 0) {
            if (firstItemMs === null) firstItemMs = Date.now() - t0;
            const first = firstItemMs;
            update((s) => ({ ...s, items: [...s.items, ...items], timing: { ...s.timing, firstItemMs: first } }));
          }
        },
      });
      if (ac.signal.aborted) return;
      const shopName = extractShopName(parser.text());
      const totalMs = Date.now() - t0;
      setCurrent((s) => {
        if (!s) return s;
        const ok = s.items.length > 0;
        const done: Scan = { ...s, shopName, status: ok ? 'done' : 'error', error: ok ? null : '글자를 찾지 못했어요. 더 가까이, 밝게 찍어 주세요.', timing: { ...s.timing, totalMs } };
        if (ok) setScans(saveScan(done)); // 사진 모드가 준비되면 여기서 prefetchPhotos(done.items) 를 호출
        return done;
      });
    } catch (e) {
      if (ac.signal.aborted) return;
      const message = e instanceof Error ? e.message : String(e);
      if (/초대 코드/.test(message)) { setAccessCode(null); setRoute('gate'); return; }
      update((s) => ({ ...s, status: 'error', error: message }));
    }
  }, [update]);

  useEffect(() => {
    if (route === 'processing' && current?.status === 'done') setRoute('result');
  }, [route, current?.status]);

  const goHome = () => { abortRef.current?.abort(); setCurrent(null); setRoute('home'); };
  const changeMode = (m: ImageMode) => { saveImageMode(m); setMode(m); };

  if (route === 'gate') return <GateScreen onEnter={() => setRoute('home')} />;
  if (route === 'processing' && current) {
    return <ProcessingScreen scan={current} onCancel={goHome} onPeek={() => setRoute('result')} onRetry={() => { if (lastFile.current) void startScan(lastFile.current); }} />;
  }
  if (route === 'result' && current) {
    return <ResultScreen scan={current} rate={rate} mode={mode} onMode={changeMode} onHome={goHome} />;
  }
  return (
    <HomeScreen
      scans={scans}
      onPick={(f) => void startScan(f)}
      onOpen={(s) => { setCurrent(upgrade(s)); setRoute('result'); }}
      onRemove={(id) => setScans(removeScan(id))}
    />
  );
};
