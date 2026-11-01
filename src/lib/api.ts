import type { Currency, NoticeSummary, OcrWord, Photo, Rate, ScanGroup, ScanLang } from '../types';
import { getAccessCode } from './storage';
import { dict, getLang } from '../i18n';
import { ApiError, emptyResponseError } from './apiError';

const headers = (): Record<string, string> => ({
  'content-type': 'application/json',
  'x-access-code': getAccessCode() ?? '',
});

export const verifyCode = async (code: string): Promise<boolean> => {
  const res = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
  return res.ok;
};

/** 저장된 초대 코드가 아직 유효한지. 401 일 때만 invalid(네트워크·서버 오류는 unknown → 내쫓지 않는다) */
export const checkStoredCode = async (code: string): Promise<'ok' | 'invalid' | 'unknown'> => {
  try {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) });
    return res.ok ? 'ok' : res.status === 401 ? 'invalid' : 'unknown';
  } catch { return 'unknown'; }
};

export type OcrEvent = { words: readonly OcrWord[]; width: number; height: number; rotation: 0 | 90 | 180 | 270; tilt: number; ms: number; used: boolean };
export type MetaEvent = { kind: string; shop_name: string | null; title: string | null; notes: readonly unknown[] };

export type AnalyzeHandlers = {
  readonly onOcr: (r: OcrEvent) => void;
  /** 원문 언어(OCR 문자 체계로 서버가 판정)와 앱 언어, 통화. mode 보다 먼저 온다 */
  readonly onLang: (lang: ScanLang, currency: Currency) => void;
  readonly onMode: (mode: 'ocr' | 'image') => void;
  /** 1단계 출력에서 종류(menu/sign/other)가 보이는 즉시. 항목보다 먼저 온다 */
  readonly onKind: (kind: string) => void;
  readonly onItem: (key: string, raw: unknown) => void;
  /** 문구(안내문은 문단) 하나 완성마다. 최종본은 onMeta 의 notes */
  readonly onNote: (key: string, raw: unknown) => void;
  readonly onMeta: (m: MetaEvent) => void;
  readonly onDetails: (items: readonly unknown[]) => void;
  /** 메뉴판 묶음 정리(2단계와 병렬). 없을 수도 있다 */
  readonly onGroups: (groups: readonly ScanGroup[]) => void;
  /** 안내문·기타 요약(meta 뒤). 없을 수도 있다 */
  readonly onSummary: (s: NoticeSummary) => void;
  readonly signal?: AbortSignal;
};

type Event =
  | ({ t: 'ocr' } & OcrEvent)
  | { t: 'lang'; src: 'ja' | 'ko'; dst: 'ja' | 'ko'; currency: Currency }
  | { t: 'mode'; mode: 'ocr' | 'image'; chunks?: number }
  | { t: 'kind'; kind: string }
  | { t: 'item'; key: string; item: unknown }
  | { t: 'note'; key: string; note: unknown }
  | { t: 'summary'; summary?: unknown; tips?: unknown }
  | ({ t: 'meta' } & MetaEvent)
  | { t: 'details'; items: unknown[] }
  | { t: 'groups'; groups: ScanGroup[] }
  | { t: 'error'; m: string; code?: 'no_vision' | 'ocr_failed' }
  | { t: 'done' };

/** NDJSON 분석 스트림을 읽어 이벤트별 콜백으로 넘긴다. 서버 오류는 예외로 던진다. */
export const analyzeImage = async (base64: string, mediaType: string, h: AnalyzeHandlers): Promise<void> => {
  const res = await fetch('/api/analyze', {
    method: 'POST', headers: headers(), body: JSON.stringify({ image: base64, mediaType, lang: getLang() }), signal: h.signal,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.status === 401 || !data.error) throw new ApiError(res.status);
    throw new Error(data.error);
  }
  if (!res.body) throw emptyResponseError();
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let pending = '';
  const handle = (raw: string) => {
    if (!raw.trim()) return;
    const ev = JSON.parse(raw) as Event;
    switch (ev.t) {
      case 'ocr': h.onOcr({ words: ev.words, width: ev.width, height: ev.height, rotation: ev.rotation ?? 0, tilt: ev.tilt ?? 0, ms: ev.ms, used: ev.used }); break;
      case 'lang': h.onLang({ src: ev.src, dst: ev.dst }, ev.currency === 'KRW' ? 'KRW' : 'JPY'); break;
      case 'mode': h.onMode(ev.mode); break;
      case 'kind': h.onKind(ev.kind); break;
      case 'item': h.onItem(ev.key, ev.item); break;
      case 'note': h.onNote(ev.key, ev.note); break;
      case 'summary': {
        const text = typeof ev.summary === 'string' ? ev.summary.trim() : '';
        const tips = Array.isArray(ev.tips) ? ev.tips.filter((t): t is string => typeof t === 'string') : [];
        if (text) h.onSummary({ text, tips });
        break;
      }
      case 'meta': h.onMeta({ kind: ev.kind, shop_name: ev.shop_name, title: typeof ev.title === 'string' && ev.title ? ev.title : null, notes: ev.notes ?? [] }); break;
      case 'details': h.onDetails(ev.items ?? []); break;
      case 'groups': h.onGroups(Array.isArray(ev.groups) ? ev.groups : []); break;
      // code 가 있으면 사용자 문구는 앱 언어 사전에서(서버 m 은 영어 진단용)
      case 'error': throw new Error(ev.code === 'no_vision' ? dict().lib.noVision : ev.code === 'ocr_failed' ? dict().lib.ocrFailed : (ev.m || dict().lib.modelError));
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
  if (!res.ok) throw new Error(dict().lib.rateFetchFailed);
  return (await res.json()) as Rate;
};

export const fetchPhoto = async (query: string): Promise<Photo> => {
  const res = await fetch(`/api/photo?q=${encodeURIComponent(query)}`);
  if (!res.ok) return { url: null };
  return (await res.json()) as Photo;
};

/** 매칭 안 된 메뉴의 도트 아이콘 생성 요청 (서버 캐시 적중이면 즉시) */
export const fetchIcons = async (items: ReadonlyArray<{ name: string; tr: string; hint?: string }>): Promise<{ icons: Record<string, readonly string[]>; failed: readonly string[] }> => {
  const res = await fetch('/api/icon', { method: 'POST', headers: headers(), body: JSON.stringify({ items }) });
  if (!res.ok) throw new Error(`icon ${res.status}`);
  const data = (await res.json()) as { icons?: Record<string, readonly string[]>; failed?: readonly string[] };
  return { icons: data.icons ?? {}, failed: data.failed ?? [] };
};
