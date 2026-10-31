/** 대화 통역 모델: 새 대화·새 마디, 말풍선에 보일 글(표시 언어 쌍별), 제목, 서버에 보낼 앞선 대화, 도우미 「말해 볼 문장」 떼기 */
import type { Talk, TalkPair, TalkTurn, TalkWho } from '../types';
import { newScanId } from './scan';
import { dict } from '../i18n';

export const newTalk = (): Talk => {
  const now = Date.now();
  return { id: newScanId(), createdAt: now, updatedAt: now, autoTitle: null, titledAt: 0, userTitle: null, turns: [], helper: [] };
};

export const newTurn = (who: TalkWho, via: TalkTurn['via'], src: string): TalkTurn =>
  ({ id: newScanId(), who, via, src, fixed: '', ja: '', ko: '', pron: '', kana: '', en: '', status: 'translating', at: Date.now() });

/** 서버 번역 결과(필드 일부 또는 전부)를 마디에 합친다. lang 이 ja 면 상대의 말(글로 쓰기에서 일본어를 넣은 경우) */
export const applyFields = (t: TalkTurn, f: Readonly<Record<string, unknown>>): TalkTurn => {
  const s = (k: string): string | undefined => (typeof f[k] === 'string' ? (f[k] as string) : undefined);
  const lang = s('lang');
  return {
    ...t,
    who: lang === 'ja' ? 'them' : lang === 'ko' ? 'me' : t.who,
    ja: s('ja') ?? t.ja, ko: s('ko') ?? t.ko, fixed: s('fixed') ?? t.fixed, pron: s('pron') ?? t.pron, kana: s('kana') ?? t.kana, en: s('en') ?? t.en,
  };
};

/** 원문(고친 것이 있으면 그것) */
export const turnSource = (t: TalkTurn): string => t.fixed || t.src;
/** 상대 언어 쪽 번역(내 말이면 일본어, 상대 말이면 한국어) */
export const turnTranslation = (t: TalkTurn): string => (t.who === 'me' ? t.ja : t.ko);

export type BubbleView = {
  /** 위 작은 줄 */
  readonly small: string;
  readonly smallLang: 'ko' | 'ja' | 'en';
  /** 가운데 큰 줄. 번역 전이면 '' */
  readonly main: string;
  readonly mainLang: 'ko' | 'ja' | 'en';
  /** 아래 발음 줄(큰 줄이 일본어일 때만) */
  readonly pron: string;
};

/**
 * 말풍선 두 언어. 큰 줄은 읽을 사람의 언어: 내 말은 상대가 읽으니 일본어(한·EN 이면 영어), 상대 말은 내가 읽으니 한국어(日·EN 이면 영어).
 * 작은 줄은 쌍의 나머지 언어.
 */
export const bubbleView = (t: TalkTurn, pair: TalkPair, showPron: boolean): BubbleView => {
  const src = turnSource(t);
  if (t.who === 'me') {
    const mainLang = pair === 'ko-en' && t.en ? 'en' : 'ja';
    const main = mainLang === 'en' ? t.en : t.ja;
    const small = pair === 'ja-en' ? t.en || src : src;
    return { small, smallLang: pair === 'ja-en' && t.en ? 'en' : 'ko', main, mainLang, pron: mainLang === 'ja' && showPron ? t.pron : '' };
  }
  const mainLang = pair === 'ja-en' && t.en ? 'en' : 'ko';
  const small = pair === 'ko-en' ? t.en || src : src;
  return { small, smallLang: pair === 'ko-en' && t.en ? 'en' : 'ja', main: mainLang === 'en' ? t.en : t.ko, mainLang, pron: '' };
};

/** 서버에 보낼 앞선 대화(완료된 마디만) */
export const contextTurns = (turns: readonly TalkTurn[]): ReadonlyArray<{ who: TalkWho; src: string; tr: string }> =>
  turns.filter((t) => t.status === 'done').map((t) => ({ who: t.who, src: turnSource(t), tr: turnTranslation(t) }));

/** 자동 제목을 (다시) 지을 때인가: 완료 2마디에 처음, 6마디에 한 번 더. 사용자가 고친 이름이 있으면 짓지 않는다 */
export const needsTitle = (talk: Talk): boolean => {
  if (talk.userTitle) return false;
  const done = talk.turns.filter((t) => t.status === 'done').length;
  return (done >= 2 && talk.titledAt < 2) || (done >= 6 && talk.titledAt < 6);
};

/** 목록·화면 제목: 고친 이름 → 자동 제목 → 첫 마디 */
export const talkTitle = (talk: Talk): string => {
  if (talk.userTitle) return talk.userTitle;
  if (talk.autoTitle) return talk.autoTitle;
  const first = talk.turns[0];
  return first ? turnSource(first).slice(0, 20) : dict().talk.newTalk;
};

/** 목록 부제용 마지막 한 줄(내가 읽는 언어로) */
export const lastLine = (talk: Talk): string => {
  const t = talk.turns[talk.turns.length - 1];
  if (!t) return dict().talk.noTurns;
  return t.who === 'me' ? turnSource(t) : t.ko || t.src;
};

/** 도우미 답 끝의 「말해 볼 문장: 일본어 (한글 발음)」 줄을 떼어 낸다 */
export const splitSay = (text: string): { readonly body: string; readonly say: { readonly ja: string; readonly pron: string } | null } => {
  const m = /(^|\n)\s*말해 볼 문장\s*[:：]\s*(.+?)\s*[（(]([^()（）]+)[)）]\s*$/.exec(text.trimEnd());
  if (!m) return { body: text.trim(), say: null };
  return { body: text.slice(0, m.index).trim(), say: { ja: m[2]!.trim(), pron: m[3]!.trim() } };
};
