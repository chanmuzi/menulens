import type { OcrWord, Photo, Rate } from '../types';
import { getAccessCode } from './storage';

const headers = (): Record<string, string> => ({
  'content-type': 'application/json',
  'x-access-code': getAccessCode() ?? '',
});

export const verifyCode = async (code: string): Promise<boolean> => {
  const res = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
  return res.ok;
};

export type AnalyzeHandlers = {
  readonly onOcr: (r: { words: readonly OcrWord[]; width: number; height: number; rotation: 0 | 90 | 180 | 270; tilt: number; ms: number; used: boolean }) => void;
  readonly onMode: (mode: 'ocr' | 'image') => void;
  readonly onText: (chunk: string) => void;
  readonly signal?: AbortSignal;
};

type Event =
  | { t: 'ocr'; width: number; height: number; words: OcrWord[]; rotation: 0 | 90 | 180 | 270; tilt: number; ms: number; used: boolean }
  | { t: 'mode'; mode: 'ocr' | 'image' }
  | { t: 'text'; d: string }
  | { t: 'error'; m: string }
  | { t: 'done' };

/** NDJSON 분석 스트림을 읽어 이벤트별 콜백으로 넘긴다. 서버 오류는 예외로 던진다. */
export const analyzeImage = async (base64: string, mediaType: string, h: AnalyzeHandlers): Promise<void> => {
  const res = await fetch('/api/analyze', {
    method: 'POST', headers: headers(), body: JSON.stringify({ image: base64, mediaType }), signal: h.signal,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 401) throw new Error('초대 코드가 더 이상 유효하지 않아요');
    throw new Error(data.error ?? `서버 오류 (${res.status})`);
  }
  if (!res.body) throw new Error('응답이 비어 있어요');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let pending = '';
  const handle = (raw: string) => {
    if (!raw.trim()) return;
    const ev = JSON.parse(raw) as Event;
    if (ev.t === 'ocr') h.onOcr({ words: ev.words, width: ev.width, height: ev.height, rotation: ev.rotation ?? 0, tilt: ev.tilt ?? 0, ms: ev.ms, used: ev.used });
    else if (ev.t === 'mode') h.onMode(ev.mode);
    else if (ev.t === 'text') h.onText(ev.d);
    else if (ev.t === 'error') throw new Error(ev.m || '모델 응답 오류');
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += dec.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    for (const l of lines) handle(l);
  }
  if (pending.trim()) handle(pending);
};

export const fetchRate = async (): Promise<Rate> => {
  const res = await fetch('/api/rate');
  if (!res.ok) throw new Error('환율을 가져오지 못했어요');
  return (await res.json()) as Rate;
};

export const fetchPhoto = async (query: string): Promise<Photo> => {
  const res = await fetch(`/api/photo?q=${encodeURIComponent(query)}`);
  if (!res.ok) return { url: null };
  return (await res.json()) as Photo;
};
