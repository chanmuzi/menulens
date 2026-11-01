/**
 * 도우미 답 끝의 「말해 볼 문장: 문장 (읽기)」 줄. 서버(api/talk.ts 가 규칙 발음을 붙임)와 클라이언트(src/lib/talk.ts 가 카드로 뗌)가 같은 파서를 쓴다.
 * 의존성 없는 순수 함수만 둔다(클라이언트도 import 한다).
 */

/** 모델에게 시키는 표시(답 언어와 상관없이 한국어). 모델이 일본어로 옮겨 쓴 「言ってみる文」도 받는다 */
export const SAY_PREFIX = '말해 볼 문장';
const SAY_LINE = /(^|\n)\s*(?:\*\*)?(?:말해 볼 문장|言ってみる文)(?:\*\*)?\s*[:：]\s*(.+?)\s*$/;
/** 끝에 붙은 괄호 하나: 읽기·발음 */
const TRAILING_PAREN = /^(.*?)\s*[（(]([^()（）]*)[)）]$/;

export type SayLine = { readonly body: string; readonly sentence: string; readonly reading: string };
/**
 * 마지막 줄의 「말해 볼 문장」을 뗀다. 없으면 null.
 * trailingParen 이 true 면 문장 끝의 괄호를 읽기(일본어 히라가나) 또는 발음으로 본다. 한국어 문장(상대가 한국어)은 괄호가 문장의 일부일 수 있어 서버가 false 로 부른다
 */
export const parseSay = (text: string, trailingParen = true): SayLine | null => {
  const m = SAY_LINE.exec(text.trimEnd());
  if (!m) return null;
  const rest = m[2]!.trim();
  const p = trailingParen ? TRAILING_PAREN.exec(rest) : null;
  return { body: text.slice(0, m.index).trim(), sentence: p ? p[1]!.trim() : rest, reading: p ? p[2]!.trim() : '' };
};
/** 「말해 볼 문장」 줄을 다시 만든다(발음이 없으면 괄호 없이) */
export const formatSay = (sentence: string, pron: string): string => `${SAY_PREFIX}: ${sentence}${pron ? ` (${pron})` : ''}`;
