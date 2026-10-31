import type { ScanKind } from '../../types';

/** chat 네임스페이스 문구(한국어): 챗 팝업·말풍선 버튼·chat.ts·kind.ts chatTitle. 키는 ja/chat.ts 와 같아야 한다 */
export const chat = {
  /** 버튼·시트 제목(종류별). 메뉴판이 아닐 때 「메뉴판에 물어보기」라고 하지 않는다 */
  title: { menu: '메뉴판에 물어보기', sign: '안내문에 물어보기', other: '사진에 물어보기' } as Readonly<Record<ScanKind, string>>,
  /** 말풍선 버튼 aria 의 새 답 배지 */
  newAnswers: (n: number) => `새 답 ${n}개`,
  /** 화면을 떠나 답이 끊겼을 때 대화에 남기는 줄 */
  disconnected: '(화면을 떠나서 답이 끊겼어요. 다시 물어봐 주세요)',
  notFoundWithPhoto: '사진을 봐도 찾지 못했어요',
  noPhoto: '사진이 없어서 답할 수 없어요',
  photoCount: (n: number) => `사진 ${n}장`,
  focusPrefix: '지금 보는: ',
  clearFocus: '맥락 지우기',
  intro: (photos: number) => `${photos > 1 ? `사진 ${photos}장에서 읽어 둔 글로 먼저 답하고, ` : '읽어 둔 글로 먼저 답하고, '}사진을 다시 봐야 하면 그렇게 표시할게요.`,
  /** 답 아래 작은 표시. photo 는 묶음일 때 사진 번호, 한 장이면 null */
  sawPhoto: (photo: number | null) => `${photo ? `${photo}번 사진을` : '사진을'} 다시 봤어요`,
  textOnly: '글자만 보고 답함',
  rePhoto: (photo: number | null) => `${photo ? `${photo}번 사진을` : '사진을'} 다시 보는 중`,
  thinking: '생각 중',
  /** 참조 칩의 다른 사진 표시 */
  photoN: (n: number) => `사진 ${n}`,
  placeholderMore: '더 물어보기',
  placeholderFirst: '궁금한 걸 물어보세요',
  inputAria: '질문',
  send: '보내기',
  /** chat.ts 오류 */
  cutOff: '답이 끊겼어요',
};
