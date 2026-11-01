/** 대화 통역 모델: 새 대화·새 마디, 말풍선에 보일 글(표시 언어 쌍별), 제목, 서버에 보낼 앞선 대화, 도우미 「말해 볼 문장」 떼기 */
import type { Talk, TalkLang, TalkPair, TalkTurn, TalkWho } from '../types';
import { newScanId } from './scan';
import { dict } from '../i18n';
import { parseSay } from '../../api/_lib/sayLine.ts';

/** 옛 기록(언어 없음)의 방향: 한국인이 일본에서 */
export const DEFAULT_TALK_LANG: TalkLang = { me: 'ko', them: 'ja' };
/** 앱 언어가 나, 그 반대가 상대 */
export const talkLangFor = (me: TalkLang['me']): TalkLang => ({ me, them: me === 'ko' ? 'ja' : 'ko' });
/** 저장된 대화를 읽을 때: 언어가 없거나 깨졌으면 내 언어(없으면 ko)에서 다시 만든다 */
export const upgradeTalk = (t: Talk): Talk => ({ ...t, lang: talkLangFor((t.lang as Partial<TalkLang> | undefined)?.me === 'ja' ? 'ja' : 'ko') });

export const newTalk = (lang: TalkLang): Talk => {
  const now = Date.now();
  return { id: newScanId(), createdAt: now, updatedAt: now, autoTitle: null, titledAt: 0, userTitle: null, turns: [], helper: [], lang };
};

export const newTurn = (who: TalkWho, via: TalkTurn['via'], src: string): TalkTurn =>
  ({ id: newScanId(), who, via, src, fixed: '', ja: '', ko: '', pron: '', kana: '', en: '', status: 'translating', at: Date.now() });

/** 서버 번역 결과(필드 일부 또는 전부)를 마디에 합친다. 입력 언어(lang)가 상대 언어면 상대의 말(글로 쓰기에서 상대 언어를 넣은 경우) */
export const applyFields = (t: TalkTurn, f: Readonly<Record<string, unknown>>, lang: TalkLang): TalkTurn => {
  const s = (k: string): string | undefined => (typeof f[k] === 'string' ? (f[k] as string) : undefined);
  const spoken = s('lang');
  return {
    ...t,
    who: spoken === lang.them ? 'them' : spoken === lang.me ? 'me' : t.who,
    ja: s('ja') ?? t.ja, ko: s('ko') ?? t.ko, fixed: s('fixed') ?? t.fixed, pron: s('pron') ?? t.pron, kana: s('kana') ?? t.kana, en: s('en') ?? t.en,
  };
};

/** 원문(고친 것이 있으면 그것) */
export const turnSource = (t: TalkTurn): string => t.fixed || t.src;
/** 읽는 사람 언어 쪽 번역(내 말이면 상대 언어, 상대 말이면 내 언어) */
export const turnTranslation = (t: TalkTurn, lang: TalkLang): string => (t.who === 'me' ? t[lang.them] : t[lang.me]);
/** 번역문을 언어 키(ja/ko)에 넣는다 */
export const withTranslation = (t: TalkTurn, l: TalkLang['me'], text: string): TalkTurn => (l === 'ja' ? { ...t, ja: text } : { ...t, ko: text });

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

/** 표시 언어 쌍에 그 언어가 있는가('ko-ja' 는 ko·ja, 'ko-en' 은 ko·en, 'ja-en' 은 ja·en) */
const pairHas = (pair: TalkPair, l: 'ko' | 'ja'): boolean => pair.split('-').includes(l);

/**
 * 말풍선 두 언어. 큰 줄은 읽을 사람의 언어: 내 말은 상대가 읽으니 상대 언어, 상대 말은 내가 읽으니 내 언어. 쌍에 그 언어가 없으면(영어 쌍) 영어.
 * 작은 줄은 원문(쌍에 원문 언어가 없으면 영어). 발음은 내 말의 큰 줄이 상대 언어일 때만.
 */
export const bubbleView = (t: TalkTurn, pair: TalkPair, showPron: boolean, lang: TalkLang): BubbleView => {
  const src = turnSource(t);
  const reader = t.who === 'me' ? lang.them : lang.me;
  const speaker = t.who === 'me' ? lang.me : lang.them;
  const mainLang = !pairHas(pair, reader) && t.en ? 'en' : reader;
  const main = mainLang === 'en' ? t.en : t[reader];
  const smallLang = !pairHas(pair, speaker) && t.en ? 'en' : speaker;
  const small = smallLang === 'en' ? t.en || src : src;
  return { small, smallLang, main, mainLang, pron: t.who === 'me' && mainLang === lang.them && showPron ? t.pron : '' };
};

/** 서버에 보낼 앞선 대화(완료된 마디만) */
export const contextTurns = (turns: readonly TalkTurn[], lang: TalkLang): ReadonlyArray<{ who: TalkWho; src: string; tr: string }> =>
  turns.filter((t) => t.status === 'done').map((t) => ({ who: t.who, src: turnSource(t), tr: turnTranslation(t, lang) }));

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

/** 도우미 답 끝의 「말해 볼 문장: 상대 언어 문장 (발음)」 줄을 떼어 낸다(서버와 같은 파서). 발음은 서버가 규칙으로 붙이며 없을 수도 있다 */
export const splitSay = (text: string): { readonly body: string; readonly say: { readonly text: string; readonly pron: string } | null } => {
  const say = parseSay(text, true);
  return say ? { body: say.body, say: { text: say.sentence, pron: say.reading } } : { body: text.trim(), say: null };
};
