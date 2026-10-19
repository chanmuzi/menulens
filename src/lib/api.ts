import type { Photo, Rate } from '../types';
import { getAccessCode } from './storage';

const ERROR_MARK = '\u0000ERROR:';

const headers = (): Record<string, string> => ({
  'content-type': 'application/json',
  'x-access-code': getAccessCode() ?? '',
});

export const verifyCode = async (code: string): Promise<boolean> => {
  const res = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
  return res.ok;
};

export type AnalyzeHandlers = {
  readonly onText: (chunk: string) => void;
  readonly signal?: AbortSignal;
};

/** 분석 스트림을 읽어 텍스트 조각을 콜백으로 넘긴다. 서버 오류는 예외로 던진다. */
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
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = dec.decode(value, { stream: true });
    const errAt = text.indexOf(ERROR_MARK);
    if (errAt >= 0) throw new Error(text.slice(errAt + ERROR_MARK.length).trim() || '모델 응답 오류');
    h.onText(text);
  }
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
