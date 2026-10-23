/**
 * 말하기 녹음. 누르면 시작, 말이 끝나고 조용해지면(또는 다시 누르면) 끝난다.
 * 소리 크기를 재서 말소리가 없던 녹음은 보내지 않는다: Whisper 는 무음에도 「감사합니다」를 지어낸다(benchmarks).
 * iPhone Safari 는 audio/mp4(AAC), Chrome 은 audio/webm 으로 녹음된다. 둘 다 /api/stt 가 받는다.
 */

/** 말소리로 볼 최소 크기(RMS, 0~1). 조용한 방의 잡음은 0.005 안팎, 말소리는 0.03 이상 */
const SPEECH_RMS = 0.02;
/** 말이 시작된 뒤 이만큼 조용하면 끝난 것으로 본다 */
const END_SILENCE_MS = 1300;
/** 한 번에 최대 녹음 길이(서버 3MB 상한의 여유) */
const MAX_MS = 30_000;
/** 이보다 짧은 말소리는 버린다(실수로 누른 것) */
const MIN_SPEECH_MS = 300;
/** 눌러 놓고 이만큼 아무 말이 없으면 끝낸다 */
const NO_SPEECH_MS = 8000;

export type Recording = { readonly blob: Blob; readonly ms: number; readonly heard: boolean };

export type RecorderHandle = {
  /** 지금 끝낸다(손으로 다시 누름). 결과는 start 가 돌려준 promise 로 */
  readonly stop: () => void;
  /** 버린다(화면을 떠남) */
  readonly cancel: () => void;
};

const pickType = (): string | undefined => {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t));
};

export const canRecord = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';

/**
 * 녹음을 시작한다. onLevel 로 0~1 크기를 화면에 넘긴다(말하는 중 표시).
 * done 은 녹음이 끝나면 결과(취소면 null)로 풀린다. 마이크 권한이 없으면 reject.
 */
export const startRecording = async (onLevel: (level: number) => void): Promise<{ readonly handle: RecorderHandle; readonly done: Promise<Recording | null> }> => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = pickType();
  // 녹음기·소리 재기 준비에서 실패하면 마이크를 바로 놓는다(오류 안내 뒤에도 마이크 표시가 켜져 있지 않게)
  let rec: MediaRecorder;
  let ctx: AudioContext;
  let analyser: AnalyserNode;
  try {
    rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const buf = new Float32Array(analyser.fftSize);

  const t0 = performance.now();
  let speechMs = 0;
  let lastLoud = 0;
  let lastTick = t0;
  let cancelled = false;
  let raf = 0;

  // 상한·백그라운드 처리는 rAF 밖에서: 숨은 탭에서는 rAF 가 멈추므로 시간 상한은 타이머로, 앱을 내리면 녹음을 버린다
  const cap = window.setTimeout(() => stop(), MAX_MS);
  const onHide = () => { if (document.visibilityState === 'hidden') { cancelled = true; stop(); } };
  document.addEventListener('visibilitychange', onHide);
  const release = () => {
    window.clearTimeout(cap);
    document.removeEventListener('visibilitychange', onHide);
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => undefined);
  };
  const stop = () => { if (rec.state !== 'inactive') rec.stop(); };

  const done = new Promise<Recording | null>((resolve) => {
    rec.onstop = () => {
      release();
      if (cancelled) { resolve(null); return; }
      const blob = new Blob(chunks, { type: (rec.mimeType || type || 'audio/mp4').split(';')[0] });
      resolve({ blob, ms: performance.now() - t0, heard: speechMs >= MIN_SPEECH_MS });
    };
  });

  // 크기 재기: 말소리가 쌓인 시간, 마지막으로 큰 소리가 난 때. 말이 시작된 뒤 조용해지면 끝낸다
  const tick = () => {
    const now = performance.now();
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const rms = Math.sqrt(sum / buf.length);
    onLevel(Math.min(1, rms / 0.15));
    if (rms >= SPEECH_RMS) { speechMs += now - lastTick; lastLoud = now; }
    lastTick = now;
    const ended = speechMs >= MIN_SPEECH_MS ? now - lastLoud > END_SILENCE_MS : now - t0 > NO_SPEECH_MS;
    if (ended) { stop(); return; }
    raf = requestAnimationFrame(tick);
  };
  rec.start();
  raf = requestAnimationFrame(tick);

  return { handle: { stop, cancel: () => { cancelled = true; stop(); } }, done };
};
