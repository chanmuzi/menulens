/** 사진 챗: 서버에 보낼 맥락 만들기, NDJSON 답 스트림 읽기, 묶음별 대화 저장(localStorage). 제목은 kind.ts 의 chatTitle.
 *  여러 장 묶음이면 사진 전부의 항목·글줄을 한 맥락으로 보내고(항목 키 「사진번호-묶음:순번」), 사진은 모델이 번호로 지정한 한 장만 붙인다. */
import type { MenuItem, Scan, ScanKind } from '../types';
import { getAccessCode } from './storage';
import { readNdjson } from './ndjson';
import { dict } from '../i18n';
import { ApiError, emptyResponseError } from './apiError';

/** 대화 한 줄. refs 는 저장용 참조 「사진 id/항목 id」(불러올 때 옛 형식을 바꾼다). sawScan 은 어느 사진을 봤는지(묶음일 때 표시용, 옛 대화에는 없다) */
export type ChatMsg = { readonly role: 'me' | 'bot'; readonly text: string; readonly refs: readonly string[]; readonly sawImage: boolean; readonly sawScan?: string | null; readonly at: number };

/** 질문 속 사진 번호(「2번 사진」「사진 2」「두 번째 사진/장」). 없으면 null */
const PHOTO_NO = /(\d+)\s*번째?\s*(?:사진|장)|사진\s*(\d+)|(첫|두|세|네|다섯|여섯)\s*번째\s*(?:사진|장)/;
const ORDINAL: Readonly<Record<string, number>> = { 첫: 1, 두: 2, 세: 3, 네: 4, 다섯: 5, 여섯: 6 };
export const photoInQuestion = (q: string): number | null => {
  const m = q.match(PHOTO_NO);
  if (!m) return null;
  return m[1] ? Number(m[1]) : m[2] ? Number(m[2]) : (ORDINAL[m[3]!] ?? null);
};
/** 이런 말이 들어간 질문은 처음부터 사진을 붙인다(서버가 [사진 필요] 로 되묻는 왕복을 줄인다). 「2번 사진에는 뭐가 있어?」처럼 사진 번호만 부르는 말은 힌트가 아니다 */
const IMAGE_HINT = /놓친|놓침|빠진|빠뜨|사진|그림|작은 글|작게|어디|위치|색|몇 번째|안 보|못 본/;
export const wantsImage = (q: string): boolean => IMAGE_HINT.test(q.replace(PHOTO_NO, ' '));

/** 서버에 보내는 항목 키: 한 장이면 항목 id 그대로, 묶음이면 「사진번호-id」(id 「묶음:순번」은 사진마다 겹친다) */
export const itemKey = (photo: number, id: string, photos: number): string => (photos > 1 ? `${photo}-${id}` : id);
/** 저장용 참조 「사진 id/항목 id」. 묶음 안 위치가 아니라 사진 id 라 실패한 사진이 기록에서 빠져 순서가 당겨져도 어긋나지 않는다 */
const refOf = (scanId: string, itemId: string): string => `${scanId}/${itemId}`;
const KEY_WITH_PHOTO = /^(\d+)-(.+)$/;
/** 모델이 답에 적은 키(「사진번호-묶음:순번」 또는 「묶음:순번」) → 저장용 참조. 번호가 없으면 지금 보는 사진. 없는 사진이면 null */
export const refFromKey = (batch: readonly Scan[], key: string, currentScanId: string): string | null => {
  const m = key.match(KEY_WITH_PHOTO);
  const scan = m ? batch[Number(m[1]) - 1] : batch.find((s) => s.id === currentScanId);
  return scan ? refOf(scan.id, m ? m[2]! : key) : null;
};
/** 저장된 참조 → 어느 사진의 어느 항목인지(묶음에 없으면 null) */
export const resolveRef = (batch: readonly Scan[], ref: string): { readonly scanId: string; readonly item: MenuItem } | null => {
  const i = ref.indexOf('/');
  if (i < 0) return null;
  const scan = batch.find((s) => s.id === ref.slice(0, i));
  const item = scan?.items.find((it) => it.id === ref.slice(i + 1));
  return scan && item ? { scanId: scan.id, item } : null;
};
/** 옛 형식 참조를 저장용으로: 「/」가 있으면 그대로, 「사진번호-id」는 그 번호의 사진, 접두 없는 「id」는 그 대화를 저장했던 사진(ownerId) */
const upgradeRef = (ref: string, scanIds: readonly string[], ownerId: string): string | null => {
  if (ref.includes('/')) return ref;
  const m = ref.match(KEY_WITH_PHOTO);
  if (!m) return refOf(ownerId, ref);
  const scanId = scanIds[Number(m[1]) - 1];
  return scanId ? refOf(scanId, m[2]!) : null;
};

/** 사진당 보낼 수 있는 항목·글줄 수의 묶음 전체 예산(서버 상한과 같다). 묶음이면 사진마다 같은 몫으로 나눠 뒤 사진이 통째로 빠지지 않게 한다 */
const MAX_ITEMS = 200;
const MAX_NOTES = 120;
const perPhoto = (max: number, photos: number): number => (photos > 1 ? Math.floor(max / photos) : max);

export type ChatContext = {
  readonly shop: string | null; readonly kind: ScanKind; readonly photos: number;
  readonly items: ReadonlyArray<{ k: string; src: string; tr: string; price: number | null; desc: string; group: string | null; p?: number }>;
  readonly notes: ReadonlyArray<{ src: string; tr: string; p?: number }>;
};
/** 묶음 전체의 결과를 서버에 보낼 축약 JSON 으로. 설명은 60자까지. 묶음이면 항목·글줄에 사진 번호 p */
export const chatContext = (batch: readonly Scan[], kind: ScanKind): ChatContext => {
  const photos = batch.length;
  const p = (i: number) => (photos > 1 ? { p: i + 1 } : {});
  return {
    shop: batch.find((s) => s.shopName)?.shopName ?? null, kind, photos,
    items: batch.flatMap((s, i) => s.items.slice(0, perPhoto(MAX_ITEMS, photos)).map((it) => ({ k: itemKey(i + 1, it.id, photos), src: it.name, tr: it.tr, price: it.price, desc: it.desc.slice(0, 60), group: it.group, ...p(i) }))),
    notes: batch.flatMap((s, i) => s.notes.slice(0, perPhoto(MAX_NOTES, photos)).map((n) => ({ src: n.text, tr: n.tr, ...p(i) }))),
  };
};

/** data URL → 서버가 받는 { data, mediaType } */
export const imagePart = (dataUrl: string): { data: string; mediaType: string } | null => {
  const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  return m ? { mediaType: m[1]!, data: m[2]! } : null;
};

type Event = { t: 'delta'; text: string } | { t: 'done'; text?: string; refs: string[]; sawImage: boolean } | { t: 'need_image'; photo?: number | null } | { t: 'error'; m: string };
export type AskResult = { readonly kind: 'answer'; readonly text: string; readonly refs: readonly string[]; readonly sawImage: boolean } | { readonly kind: 'need_image'; /** 모델이 지정한 사진 번호. 없으면 null(지금 보는 사진) */ readonly photo: number | null };

/** 한 번 묻는다. 답 글자가 오는 대로 onDelta(누적 본문). 서버가 사진을 요구하면 need_image 로 끝난다(묶음이면 어느 사진인지 photo) */
export const askMenu = async (
  req: { context: ChatContext; focus: string | null; question: string; history: readonly ChatMsg[]; image: { data: string; mediaType: string } | null; /** 붙인 사진의 번호(묶음일 때) */ imagePhoto: number | null },
  onDelta: (text: string) => void, signal?: AbortSignal,
): Promise<AskResult> => {
  const res = await fetch('/api/chat', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', 'x-access-code': getAccessCode() ?? '' },
    body: JSON.stringify({ ...req.context, focus: req.focus, question: req.question, history: req.history.slice(-6).map((m) => ({ role: m.role, text: m.text })), image: req.image, imagePhoto: req.imagePhoto }),
  });
  if (!res.ok) throw new ApiError(res.status);
  if (!res.body) throw emptyResponseError();
  let text = '';
  let result: AskResult | null = null;
  await readNdjson<Event>(res.body, (ev) => {
    if (ev.t === 'delta') { text += ev.text; onDelta(stripRefs(text)); }
    else if (ev.t === 'done') result = { kind: 'answer', text: ev.text ?? stripRefs(text), refs: ev.refs, sawImage: ev.sawImage };
    else if (ev.t === 'need_image') result = { kind: 'need_image', photo: ev.photo ?? null };
    else if (ev.t === 'error') throw new Error(ev.m);
  });
  if (!result) throw new Error(dict().chat.cutOff);
  return result;
};

/** 스트리밍 중 화면에 보이는 본문에서 끝의 「참조: …」 줄을 뗀다. 완료본은 서버가 정리해 보낸다 */
export const stripRefs = (text: string): string => text.trimEnd().replace(/(^|\n)\s*참조[:：][^\n]*$/, '').trimEnd();

/** storage.ts 의 removeScans/clearScans 가 같은 접두어로 지운다. 묶음의 대화는 사진 하나(ChatPopup 이 고른 완료된 첫 사진)의 키 아래 둔다 */
const KEY = (scanId: string): string => `ml.chat.${scanId}`;
const MAX_SAVED = 20;
export const loadChat = (scanId: string): readonly ChatMsg[] => {
  try { const raw = localStorage.getItem(KEY(scanId)); return raw ? (JSON.parse(raw) as ChatMsg[]) : []; } catch { return []; }
};
/** 묶음의 대화: 사진 전부의 키에서 읽어 시간순으로 합친다(사진별로 저장하던 옛 대화도 이어받는다. 같은 줄이 두 키에 있으면 하나만). 참조는 저장용 형식으로 바꾼다 */
export const loadBatchChat = (scanIds: readonly string[]): readonly ChatMsg[] => {
  const seen = new Set<string>();
  return scanIds
    .flatMap((id) => loadChat(id).map((m) => ({ ...m, refs: m.refs.flatMap((r) => { const u = upgradeRef(r, scanIds, id); return u ? [u] : []; }) })))
    .sort((a, b) => a.at - b.at)
    .filter((m) => { const k = `${m.at}|${m.role}|${m.text}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(-MAX_SAVED);
};
export const saveChat = (scanId: string, msgs: readonly ChatMsg[]): void => {
  try { localStorage.setItem(KEY(scanId), JSON.stringify(msgs.slice(-MAX_SAVED))); } catch { /* 저장 못 해도 대화는 이어진다 */ }
};
