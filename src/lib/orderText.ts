/**
 * 주문 문구 조립(순수 함수). 사전은 인자로 받아 React·앱 언어에 기대지 않으므로 node 테스트(scripts/bench/order_test.ts)로 고정한다.
 * 원문(src)은 사진 원문 언어로 직원에게 보여줄 글, 발음(pron)은 앱 언어 글자(원문과 앱 언어가 같으면 ''), 뜻(tr)은 사진의 번역 언어 사전.
 * 발음은 모델이 아니라 규칙으로만: 한국어 원문은 서버와 같은 hangulToKana, 일본어 원문의 고정 문구는 손으로 적은 한글.
 */
import type { MenuItem, ScanLang } from '../types.ts';
import type { order as KoOrder } from '../i18n/ko/order.ts';
import { hangulToKana } from '../../api/_lib/hangulToKana.ts';

export type OrderDict = typeof KoOrder;
/** 조립에 필요한 줄 정보(order.ts 의 OrderLine 이 이를 포함한다) */
export type TextLine = { readonly item: MenuItem; readonly qty: number; readonly lang: ScanLang };
/** 직원에게 보여줄 원문(src) · 앱 언어 글자로 읽는 발음(pron, 원문과 앱 언어가 같으면 '') · 번역 언어 뜻(tr) */
export type OrderText = { readonly src: string; readonly pron: string; readonly tr: string };
/**
 * 상황별 앞뒤 인사. 추가 주문 때마다 「注文お願いします … 以上です」를 붙이면 어색해서(사용자 결정 2026-10-21) 셋으로 나눈다.
 * first: 첫 주문 · more: 추가 주문 · plain: 항목만(직원이 이미 와 있을 때)
 */
export type OrderMode = 'first' | 'more' | 'plain';

/** 일본어 개수 세기(ひとつ…とお), 11 이상은 N個 */
const COUNT_JA = ['', 'ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', 'むっつ', 'ななつ', 'やっつ', 'ここのつ', 'とお'];
const COUNT_JA_PRON = ['', '히토츠', '후타츠', '밋츠', '욧츠', '이츠츠', '뭇츠', '나나츠', '얏츠', '코코노츠', '토오'];
const countJa = (n: number): string => COUNT_JA[n] ?? `${n}個`;
const countJaPron = (n: number): string => COUNT_JA_PRON[n] ?? `${n}코`;
/** 한국어 개수 세기(하나…열), 11 이상은 N개 */
const COUNT_KO = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열'];

/** 「N인분」이 든 괄호 전체, 또는 괄호 밖의 「N인분」 */
const PORTION_PAREN = /\s*[(（][^()（）]*인분[^()（）]*[)）]/g;
const PORTION_BARE = /\s*\d*\s*인분/g;
/**
 * 한국어 메뉴 이름의 「인분」 단위. 「삼겹살 (1인분 180g)」 → 1, 「부대찌개 (2인분)」 → 2(냄비 하나가 2인분), 숫자 없이 「인분」만 있으면 1, 없으면 null.
 * 말할 때는 이름에서 인분 토막을 떼고 「N×수량 인분」으로 센다. 크기 같은 다른 괄호(「파전(대)」)는 직원이 읽어야 하니 그대로 둔다.
 */
const portionOf = (name: string): number | null => {
  const m = /(\d+)\s*인분/.exec(name);
  return m ? Number(m[1]) : /인분/.test(name) ? 1 : null;
};
/** 직원에게 보여줄 한국어 이름: 인분 토막만 뗀다 */
export const spokenKo = (name: string): string => name.replace(PORTION_PAREN, '').replace(PORTION_BARE, '').replace(/\s+/g, ' ').trim();
const countKo = (item: MenuItem, qty: number): string => {
  const portion = portionOf(item.name);
  return portion !== null ? `${portion * qty}인분` : COUNT_KO[qty] ?? `${qty}개`;
};

const stripParen = (s: string): string => s.replace(/\s*[(（][^()（）]*[)）]\s*$/, '');
/** 일본어 원문의 발음: 서버 규칙 값(가나 읽기 → 한글). 없으면(가나 아닌 읽기·옛 기록) 번역 이름으로 대신한다 */
const pronJa = (it: MenuItem): string => it.pron || stripParen(it.tr);

/** 앞 인사 · 목록 끝 부호 · 뒤 인사 */
type Frame = { readonly head: string; readonly end: string; readonly tail: string };
const F = (head: string, end: string, tail: string): Frame => ({ head, end, tail });
/** 일본어 원문: 직원에게 보여줄 일본어와 그 한글 발음(고정 문구라 손으로 적었다) */
const FRAMES_JA: Readonly<Record<OrderMode, { readonly src: Frame; readonly pron: Frame }>> = {
  first: { src: F('すみません、注文お願いします。', '。', '以上です。'), pron: F('스미마셍, 츄-몬 오네가이시마스.', '.', '이죠-데스.') },
  more: { src: F('すみません、追加で注文お願いします。', '。', '以上です。'), pron: F('스미마셍, 츠이카데 츄-몬 오네가이시마스.', '.', '이죠-데스.') },
  // 항목만: 목록을 「、」로 열어 두고 お願いします 로 잇는다 (「ふたつ。 お願いします。」보다 자연스럽다)
  plain: { src: F('', '、', 'お願いします。'), pron: F('', ',', '오네가이시마스.') },
};
/** 한국어 원문: 직원에게 보여줄 한국어. 가타카나 발음은 규칙(hangulToKana)으로 만든다 */
const FRAMES_KO: Readonly<Record<OrderMode, Frame>> = {
  first: F('저기요, 주문할게요.', '.', '이상이요.'),
  more: F('저기요, 추가 주문할게요.', '.', '이상이요.'),
  // 항목만: 「김치찌개 하나, 삼겹살 2인분 주세요.」
  plain: F('', '', '주세요.'),
};
const join = (head: string, body: string, tail: string): string => [head, body, tail].filter((t) => t.length > 0).join('\n');
/** 뜻 줄: 사전의 인사·구분 부호 + 「번역 이름 N개」 */
const meaning = (o: OrderDict, lines: readonly TextLine[], mode: OrderMode): string => {
  const f = o.frames[mode];
  return join(f.head, `${lines.map((l) => `${l.item.tr} ${o.countSuffix(l.qty)}`).join(`${o.frames.sep}\n`)}${mode === 'plain' ? '' : o.frames.end}`, f.tail);
};

/** 직원에게 보여줄 원문 · 읽을 수 있는 발음 · 뜻. 모든 줄이 같은 방향(lang)이어야 한다(order.ts 의 batchLines 가 보장) */
export const orderText = (o: OrderDict, lines: readonly TextLine[], mode: OrderMode, lang: ScanLang): OrderText => {
  const tr = meaning(o, lines, mode);
  if (lang.src === 'ja') {
    const f = FRAMES_JA[mode];
    const src = join(f.src.head, `${lines.map((l) => `${l.item.name} ${countJa(l.qty)}`).join('、\n')}${f.src.end}`, f.src.tail);
    const pron = lang.dst === 'ja' ? '' : join(f.pron.head, `${lines.map((l) => `${pronJa(l.item)} ${countJaPron(l.qty)}`).join(',\n')}${f.pron.end}`, f.pron.tail);
    return { src, pron, tr };
  }
  const f = FRAMES_KO[mode];
  const spoken = lines.map((l) => `${spokenKo(l.item.name)} ${countKo(l.item, l.qty)}`);
  const src = join(f.head, `${spoken.join(',\n')}${f.end}`, f.tail);
  // 발음은 보여주는 글 그대로를 규칙으로 옮긴다(괄호·숫자는 그대로 남는다)
  const pron = lang.dst === 'ko' ? '' : join(hangulToKana(f.head), `${spoken.map(hangulToKana).join(',\n')}${f.end}`, hangulToKana(f.tail));
  return { src, pron, tr };
};

/** 상세 시트의 「하나 주세요」 문구: 원문 · 발음 · 뜻 */
export const oneOrderText = (o: OrderDict, item: MenuItem, lang: ScanLang): OrderText => {
  const tr = o.oneOrder(item.tr);
  if (lang.src === 'ja') return { src: `${item.name}を ひとつ ください。`, pron: lang.dst === 'ja' ? '' : `${pronJa(item)}오 히토츠 쿠다사이`, tr };
  const spoken = `${spokenKo(item.name)} ${countKo(item, 1)} 주세요.`;
  return { src: spoken, pron: lang.dst === 'ko' ? '' : hangulToKana(spoken), tr };
};
