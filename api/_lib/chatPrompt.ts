/** 사진 챗 프롬프트. 입력은 이미 뽑아 둔 항목·글줄 JSON 이고, 사진은 필요할 때만 붙는다. 메뉴판·안내문·기타 글 어느 쪽에도 맞게 종류별 안내를 붙인다.
 *  여러 장 묶음이면 항목·글줄에 사진 번호(p)가 있고 항목 키는 「사진번호-묶음:순번」. 모델은 볼 사진을 [사진 필요: n] 으로 지정한다.
 *  답 언어는 사진의 번역 언어(dst): 한국어 앱은 한국어, 일본어 앱은 일본어. 프롬프트 본문과 프로토콜 표시([사진 필요]·참조:)는 답 언어와 상관없이 한국어다. */
import { currencyOf, type Direction, type Lang } from './direction.js';
import { L as LANG } from './prompt.js';

/** 사진 없이 답할 수 없을 때 모델이 내는 유일한 출력(한 장). 여러 장이면 [사진 필요: n] */
export const NEED_IMAGE_MARK = '[사진 필요]';
/** 스트림 앞부분에서 사진 요청을 알아보는 접두(번호가 붙든 안 붙든). 일본어로 답하는 모델이 표시를 옮겨 쓰는 경우도 받는다 */
export const NEED_IMAGE_PREFIXES: readonly string[] = ['[사진 필요', '[写真が必要', '[写真必要'];
/** 전각 숫자 → 반각(일본어 IME·모델 출력) */
export const asciiDigits = (s: string): string => s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30));
/** 완성된 출력에서 사진 요청과 번호를 읽는다. 번호가 없으면 null */
export const parseNeedImage = (text: string): { readonly need: boolean; readonly photo: number | null } => {
  const m = asciiDigits(text.trimStart()).match(/^\[(?:사진 필요|写真(?:が)?必要)(?:\s*[:：]\s*(\d+))?\]/);
  return m ? { need: true, photo: m[1] ? Number(m[1]) : null } : { need: false, photo: null };
};
/** 답 끝에 붙이는 참조 줄 접두 */
export const REFS_PREFIX = '참조:';
/** 참조 줄을 알아보는 정규식 조각(한국어 표시가 기준, 일본어 표기도 방어). 클라이언트 stripRefs 와 같다 */
export const REFS_LINE = /(^|\n)\s*(?:참조|参照)[:：]\s*([^\n]*)\s*$/;

export type ChatKind = 'menu' | 'sign' | 'other';
/** 맥락 줄에 쓰는 종류 이름 */
export const KIND_KO: Readonly<Record<ChatKind, string>> = { menu: '메뉴판', sign: '안내문', other: '사진 속 글' };

/** 언어별 조각: 이름·나라는 prompt.ts 와 공유, 사용자 호칭(앱 언어 = 번역 언어 기준)과 답 말투만 여기 */
const L: Readonly<Record<Lang, { readonly name: string; readonly country: string; readonly person: string; readonly tone: string }>> = {
  ko: { name: LANG.ko.name, country: LANG.ko.country, person: '한국인', tone: '반말이 아닌 부드러운 존댓말' },
  ja: { name: LANG.ja.name, country: LANG.ja.country, person: '일본인', tone: '정중하고 자연스러운 です・ます체' },
};
/** 사용자 호칭: 사진이 있는 나라(src)를 여행 중인 앱 언어(dst) 사람. 원문과 앱 언어가 같으면 여행 표현을 뺀다 */
const userOf = (d: Direction): string => (d.src === d.dst ? `${L[d.dst].person}` : `${L[d.src].country} 여행 중인 ${L[d.dst].person}`);
/** 맥락 줄의 통화(원문 언어의 나라) */
export const currencyLine = (d: Direction): string => `통화: ${currencyOf(d.src)}`;
/** 사진을 봤는데 목록 밖에 더 없을 때 모델이 쓸 말(답 언어별) */
const NONE_MORE: Readonly<Record<Lang, string>> = { ko: '목록 밖에 더 보이는 건 없어요', ja: 'リスト以外に見えるものはありません' };
/** 사진을 붙여도 찾지 못했을 때 서버가 내는 답(답 언어별). api/chat.ts 가 쓴다 */
export const NOT_FOUND: Readonly<Record<Lang, string>> = { ko: '사진에서도 찾지 못했어요.', ja: '写真でも見つかりませんでした。' };

/** 종류별로 다른 부분: 무엇을 보고 있고 어떤 질문이 오는지 */
const kindGuide = (kind: ChatKind, d: Direction): string => ({
  menu: `지금 보는 것은 식당 메뉴판입니다. 항목(items)은 메뉴이고 notes 는 메뉴가 아닌 문구(제목·안내·세금 표기)입니다.
자주 오는 질문: 메뉴 설명·추천·가격 비교·몇 인분·재료·알레르기·주문할 때 할 말. 메뉴 이름은 ${L[d.dst].name} 이름(tr)을 쓰고 원문은 괄호로 한 번만.`,
  sign: `지금 보는 것은 안내문·표지판입니다. notes 가 글줄이고 items 는 보통 비어 있습니다(상품명 같은 것이 잡히면 들어 있을 수 있음).
자주 오는 질문: 무슨 뜻인지, 지켜야 할 규칙·금지·주의, 지금 해야 할 행동(줄 서기·계산 방법·시간), 영업시간·휴무. 메뉴판을 전제하지 말고 글의 내용으로 답합니다.`,
  other: `지금 보는 것은 사진 속 ${L[d.src].name} 글(포장·전단·화면·표 등)입니다. notes 가 글줄이고 items 는 보통 비어 있습니다.
자주 오는 질문: 무슨 뜻인지, 어떻게 쓰는 건지, 주의할 점, 숫자·날짜·가격의 의미. 식당이나 메뉴판을 전제하지 말고 글의 내용으로 답합니다.`,
})[kind];

/** 여러 장 묶음일 때만 덧붙이는 안내 */
const BATCH_GUIDE = `사진이 여러 장입니다. 항목·글줄의 p 는 사진 번호(1부터)이고 항목 k 는 「사진번호-묶음:순번」(예: 2-0:3)입니다. 사용자가 「2번 사진」「두 번째 장」「2枚目」「写真2」라고 하면 p 가 그 번호인 것입니다.
사진 없이 답할 수 없을 때는 어느 사진을 봐야 하는지 번호를 붙여 정확히 [사진 필요: n] 만 출력합니다(모르면 ${NEED_IMAGE_MARK}). 사진이 첨부되어 오면 「사진 n 첨부」로 어느 장인지 알려 줍니다.`;

/** 종류·방향에 맞는 시스템 프롬프트. photos 가 2 이상이면 묶음 안내를 붙인다. 답은 d.dst 언어 */
export const chatSystem = (kind: ChatKind, photos: number, d: Direction): string => `당신은 ${userOf(d)} 옆에서 사진 속 글(${L[d.src].name})을 같이 읽어 주는 친구입니다. 답은 반드시 ${L[d.dst].name}로, ${L[d.dst].tone}로, 2~4문장 안에 씁니다. 질문이 다른 언어로 와도 답은 ${L[d.dst].name}입니다.
단, 아래 규칙의 표시 ${NEED_IMAGE_MARK} 와 ${REFS_PREFIX} 는 답 언어와 상관없이 그대로(한국어로) 씁니다.${d.src !== d.dst ? ` 가게에서 말하거나 보여 줄 표현(주문·요청·질문)을 알려 줄 때는 ${L[d.src].name} 원문 문장을 함께 적고 뜻은 ${L[d.dst].name}로 씁니다.` : ''}

입력으로 사진에서 이미 읽어 둔 항목 목록(번호 k, 원문 src, ${L[d.dst].name} tr, 가격 price, 설명 desc, 묶음 group)과 글줄(notes: 원문 src, 번역 tr), 지금 보고 있는 항목(focus), 최근 대화, 질문이 옵니다. 사진이 함께 오면 사진도 봅니다.

${kindGuide(kind, d)}
${photos > 1 ? `\n${BATCH_GUIDE}\n` : ''}
규칙:
- 항목 목록과 글줄만으로 답할 수 있으면 사진 없이 답합니다.
- 사진 없이는 답할 수 없는 질문(놓친 글씨, 작은 글씨, 사진의 위치·색·그림, 목록에 없는 것, 「빠진 게 있나」)인데 사진이 오지 않았으면 다른 말 없이 정확히 ${NEED_IMAGE_MARK} 만 출력합니다.
- 사진이 왔으면 목록에 없는 글귀(작은 주석, 조건, 요금, 시간, 금지 표시 등)를 찾아 알려 줍니다. 없으면 「${NONE_MORE[d.dst]}」라고 말합니다.
- 원문 표현을 인용할 때는 ${L[d.dst].name} 뜻을 먼저 쓰고 원문은 괄호로 한 번만. 모르는 것은 추정이라고 밝힙니다.
- 답에서 언급한 항목(items)이 있으면 마지막 줄에 ${REFS_PREFIX} 뒤에 그 항목의 k 를 쉼표로 적습니다(예: ${REFS_PREFIX} 0:3, 1:2). 없으면 이 줄을 생략합니다.
- 질문과 무관한 인사·사족은 넣지 않습니다.`;
