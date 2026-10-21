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

export type OcrEvent = { words: readonly OcrWord[]; width: number; height: number; rotation: 0 | 90 | 180 | 270; tilt: number; ms: number; used: boolean };
export type MetaEvent = { kind: string; shop_name: string | null; notes: readonly unknown[] };

export type AnalyzeHandlers = {
  readonly onOcr: (r: OcrEvent) => void;
  readonly onMode: (mode: 'ocr' | 'image') => void;
  /** 1단계 출력에서 종류(menu/sign/other)가 보이는 즉시. 항목보다 먼저 온다 */
  readonly onKind: (kind: string) => void;
  readonly onItem: (key: string, raw: unknown) => void;
  readonly onMeta: (m: MetaEvent) => void;
  readonly onDetails: (items: readonly unknown[]) => void;
  readonly signal?: AbortSignal;
};

type Event =
  | ({ t: 'ocr' } & OcrEvent)
  | { t: 'mode'; mode: 'ocr' | 'image'; chunks?: number }
  | { t: 'kind'; kind: string }
  | { t: 'item'; key: string; item: unknown }
  | ({ t: 'meta' } & MetaEvent)
  | { t: 'details'; items: unknown[] }
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
    switch (ev.t) {
      case 'ocr': h.onOcr({ words: ev.words, width: ev.width, height: ev.height, rotation: ev.rotation ?? 0, tilt: ev.tilt ?? 0, ms: ev.ms, used: ev.used }); break;
      case 'mode': h.onMode(ev.mode); break;
      case 'kind': h.onKind(ev.kind); break;
      case 'item': h.onItem(ev.key, ev.item); break;
      case 'meta': h.onMeta({ kind: ev.kind, shop_name: ev.shop_name, notes: ev.notes ?? [] }); break;
      case 'details': h.onDetails(ev.items ?? []); break;
      case 'error': throw new Error(ev.m || '모델 응답 오류');
      default: break;
    }
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

/** 매칭 안 된 메뉴의 도트 아이콘 생성 요청 (서버 캐시 적중이면 즉시) */
export const fetchIcons = async (items: ReadonlyArray<{ name_ja: string; name_ko: string; hint?: string }>): Promise<{ icons: Record<string, readonly string[]>; failed: readonly string[] }> => {
  const res = await fetch('/api/icon', { method: 'POST', headers: headers(), body: JSON.stringify({ items }) });
  if (!res.ok) throw new Error(`icon ${res.status}`);
  const data = (await res.json()) as { icons?: Record<string, readonly string[]>; failed?: readonly string[] };
  return { icons: data.icons ?? {}, failed: data.failed ?? [] };
};
