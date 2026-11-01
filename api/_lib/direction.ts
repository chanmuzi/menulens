/** 번역 방향: 사진 원문 언어(src)와 앱 언어(dst). 클라이언트가 dst 를 보내고 서버가 OCR 단어의 문자 체계로 src 를 판정한다 */
import type { OcrWord } from './ocr.js';

export type Lang = 'ja' | 'ko';
export type Direction = { readonly src: Lang; readonly dst: Lang };
export type Currency = 'JPY' | 'KRW';

export const parseLang = (v: unknown): Lang => (v === 'ja' ? 'ja' : 'ko');
/** 클라이언트가 보낸 사진의 방향 {src,dst}. 문자열이면 analyze 와 같이 dst 로 보고 src 는 그 반대. 없거나 깨졌으면 일→한(옛 클라이언트) */
export const parseDirection = (v: unknown): Direction => {
  const o = typeof v === 'object' && v !== null ? (v as { src?: unknown; dst?: unknown }) : { dst: v };
  const dst = parseLang(o.dst);
  return { src: o.src === 'ko' || o.src === 'ja' ? o.src : otherLang(dst), dst };
};
export const otherLang = (l: Lang): Lang => (l === 'ko' ? 'ja' : 'ko');
/** 가격 통화는 원문 언어(사진이 있는 나라)를 따른다 */
export const currencyOf = (src: Lang): Currency => (src === 'ko' ? 'KRW' : 'JPY');
export const dirKey = (d: Direction): string => `${d.src}-${d.dst}`;

/** 대화 통역의 방향: 나(앱 언어)와 상대. 클라이언트가 대화를 만들 때의 앱 언어를 보낸다. 없으면 한→일(옛 클라이언트) */
export type TalkDirection = { readonly me: Lang; readonly them: Lang };
export const parseTalkDirection = (v: unknown): TalkDirection => {
  const o = typeof v === 'object' && v !== null ? (v as { me?: unknown }) : {};
  const me: Lang = o.me === 'ja' ? 'ja' : 'ko';
  return { me, them: otherLang(me) };
};

const HANGUL = /[가-힣ㄱ-ㅎㅏ-ㅣ]/g;
const KANA_KANJI = /[ぁ-ゖァ-ヺ一-鿿]/g;
/** 이만큼만 보여도 「그 언어 글이 있다」고 본다 */
const MIN_SCRIPT = 2;

/**
 * OCR 단어의 문자 체계로 원문 언어 판정.
 * 1) 앱 언어의 반대(기대하는 외국어: 한국어 UI 는 일본어, 일본어 UI 는 한국어)의 글자(가나·한자 / 한글)가 조금이라도 있으면 그 언어.
 *    한국어 설명이 병기된 일본 메뉴판(관광지에 흔함, 요리명은 한자뿐인 경우가 많다)을 한국 사진으로 보지 않기 위해서다.
 *    대가: 한국어 UI 로 「大·中·小」 같은 한자가 든 한국 메뉴판을 찍으면 일본 사진으로 본다(한국어 UI 의 한국 사진은 본래 쓰임이 아니다).
 * 2) 아니면 한글 vs 가나·한자 다수결. 둘 다 없으면(영문·숫자뿐, OCR 실패) 기대하는 외국어.
 */
export const detectSrc = (words: readonly OcrWord[], dst: Lang): Lang => {
  const text = words.map((w) => w.t).join('');
  const hangul = (text.match(HANGUL) ?? []).length;
  const jk = (text.match(KANA_KANJI) ?? []).length;
  const expected = otherLang(dst);
  if ((expected === 'ja' ? jk : hangul) >= MIN_SCRIPT) return expected;
  if (hangul === 0 && jk === 0) return expected;
  return hangul > jk ? 'ko' : 'ja';
};
