/** 사진 챗: 서버에 보낼 맥락 만들기, NDJSON 답 스트림 읽기, 스캔별 대화 저장(localStorage). 칩 문구 정책은 chatChips.ts */
import type { Scan, ScanKind } from '../types';
import { getAccessCode } from './storage';

export type ChatMsg = { readonly role: 'me' | 'bot'; readonly text: string; readonly refs: readonly string[]; readonly sawImage: boolean; readonly at: number };

/** 이런 말이 들어간 질문은 처음부터 사진을 붙인다(서버가 [사진 필요] 로 되묻는 왕복을 줄인다) */
const IMAGE_HINT = /놓친|놓침|빠진|빠뜨|사진|그림|작은 글|작게|어디|위치|색|몇 번째|안 보|못 본/;
export const wantsImage = (q: string): boolean => IMAGE_HINT.test(q);

export type ChatContext = {
  readonly shop: string | null; readonly kind: ScanKind;
  readonly items: ReadonlyArray<{ k: string; ja: string; ko: string; price: number | null; desc: string; group: string | null }>;
  readonly notes: ReadonlyArray<{ ja: string; ko: string }>;
};
/** 스캔 결과를 서버에 보낼 축약 JSON 으로. 설명은 60자까지 */
export const chatContext = (scan: Scan): ChatContext => ({
  shop: scan.shopName, kind: scan.kind,
  items: scan.items.map((it) => ({ k: it.id, ja: it.name_ja, ko: it.name_ko, price: it.price_jpy, desc: it.desc_ko.slice(0, 60), group: it.group })),
  notes: scan.notes.map((n) => ({ ja: n.text_ja, ko: n.text_ko })),
});

/** data URL → 서버가 받는 { data, mediaType } */
export const imagePart = (dataUrl: string): { data: string; mediaType: string } | null => {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  return m ? { mediaType: m[1]!, data: m[2]! } : null;
};

type Event = { t: 'delta'; text: string } | { t: 'done'; text?: string; refs: string[]; sawImage: boolean } | { t: 'need_image' } | { t: 'error'; m: string };
export type AskResult = { readonly kind: 'answer'; readonly text: string; readonly refs: readonly string[]; readonly sawImage: boolean } | { readonly kind: 'need_image' };

/** 한 번 묻는다. 답 글자가 오는 대로 onDelta(누적 본문). 서버가 사진을 요구하면 need_image 로 끝난다 */
export const askMenu = async (
  req: { context: ChatContext; focus: string | null; question: string; history: readonly ChatMsg[]; image: { data: string; mediaType: string } | null },
  onDelta: (text: string) => void, signal?: AbortSignal,
): Promise<AskResult> => {
  const res = await fetch('/api/chat', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-access-code': getAccessCode() ?? '' },
    body: JSON.stringify({ ...req.context, focus: req.focus, question: req.question, history: req.history.slice(-6).map((m) => ({ role: m.role, text: m.text })), image: req.image }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('초대 코드가 더 이상 유효하지 않아요');
    throw new Error(`서버 오류 (${res.status})`);
  }
  if (!res.body) throw new Error('응답이 비어 있어요');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let pending = '';
  let text = '';
  let result: AskResult | null = null;
  const handle = (raw: string) => {
    if (!raw.trim()) return;
    const ev = JSON.parse(raw) as Event;
    if (ev.t === 'delta') { text += ev.text; onDelta(stripRefs(text)); }
    else if (ev.t === 'done') result = { kind: 'answer', text: ev.text ?? stripRefs(text), refs: ev.refs, sawImage: ev.sawImage };
    else if (ev.t === 'need_image') result = { kind: 'need_image' };
    else if (ev.t === 'error') throw new Error(ev.m);
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += dec.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    lines.forEach(handle);
  }
  if (pending.trim()) handle(pending);
  if (!result) throw new Error('답이 끊겼어요');
  return result;
};

/** 스트리밍 중 화면에 보이는 본문에서 끝의 「참조: …」 줄을 뗀다. 완료본은 서버가 정리해 보낸다 */
export const stripRefs = (text: string): string => text.trimEnd().replace(/(^|\n)\s*참조[:：][^\n]*$/, '').trimEnd();

/** storage.ts 의 removeScans/clearScans 가 같은 접두어로 지운다 */
const KEY = (scanId: string): string => `ml.chat.${scanId}`;
const MAX_SAVED = 20;
export const loadChat = (scanId: string): readonly ChatMsg[] => {
  try { const raw = localStorage.getItem(KEY(scanId)); return raw ? (JSON.parse(raw) as ChatMsg[]) : []; } catch { return []; }
};
export const saveChat = (scanId: string, msgs: readonly ChatMsg[]): void => {
  try { localStorage.setItem(KEY(scanId), JSON.stringify(msgs.slice(-MAX_SAVED))); } catch { /* 저장 못 해도 대화는 이어진다 */ }
};
