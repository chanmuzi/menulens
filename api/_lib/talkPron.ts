/**
 * 대화 통역의 규칙 발음. 모델은 발음을 쓰지 않는다: 상대 언어가 일본어면 모델의 히라가나 읽기(kana)를 한글로(조사 は·へ 규칙 포함), 한국어면 문장을 가타카나로.
 * 검사: node --experimental-strip-types --import ./scripts/bench/register-ts.mjs --test scripts/bench/talk_test.ts
 */
import type { TalkDirection } from './direction.js';
import { kanaToHangul } from './kanaToHangul.js';
import { hangulToKana } from './hangulToKana.js';
import { formatSay, parseSay } from './sayLine.js';

/** 읽기(히라가나)에서 문장부호·기호를 떼어 규칙에 넣을 수 있게 한다(ー·ゝ 는 남는다). 가나가 아닌 글자(한자·숫자)가 남으면 규칙이 '' 를 돌려준다 */
export const cleanKana = (k: string): string => k.normalize('NFKC').replace(/[\p{P}\p{S}]/gu, ' ');
/** 상대 언어 문장의 내 글자 발음. 상대가 일본어면 kana 가 있어야 하고, 한국어면 문장 자체로 만든다(괄호는 읽지 않는다) */
export const pronOf = (d: TalkDirection, sentence: string, kana: string): string =>
  d.them === 'ja' ? kanaToHangul(cleanKana(kana), { particles: true }) : hangulToKana(sentence.replace(/[()（）]/g, ' ')).replace(/\s+/g, ' ').trim();
/** 도우미 답 끝의 「말해 볼 문장」 줄에 규칙 발음을 붙인다. 못 만들면 괄호 없이 둔다. 줄이 없으면 답 그대로 */
export const sayWithPron = (text: string, d: TalkDirection): string => {
  const say = parseSay(text, d.them === 'ja');
  if (!say) return text.trim();
  return `${say.body}\n${formatSay(say.sentence, pronOf(d, say.sentence, say.reading))}`.trim();
};
/** 이력(assistant)으로 보낼 때 앱이 붙인 발음 괄호를 뗀다(모델이 그 형식을 따라 괄호에 한글을 쓰지 않게) */
export const stripSayPron = (text: string): string => {
  const say = parseSay(text, true);
  return say ? `${say.body}\n${formatSay(say.sentence, '')}`.trim() : text;
};
