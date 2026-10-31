import type { ScanKind } from '../../types';

/** processing 네임스페이스 문구(한국어). 처리 중 화면과 이미지 준비 오류. 키는 ja/processing.ts 와 같아야 한다 */
export const processing = {
  /** 종류 판정 전(unknown)·후의 상단 제목 */
  title: { unknown: '읽는 중', menu: '메뉴판 읽는 중', sign: '안내문 읽는 중', other: '글자 읽는 중' } as Readonly<Record<ScanKind | 'unknown', string>>,
  failedTitle: '읽지 못했어요',
  cancelHome: '취소하고 홈으로',
  /** 진행 게이지의 보조 기술용 설명 */
  progressMenuAria: (n: number) => `메뉴 ${n}개 찾음`,
  progressTranslating: '번역하는 중',
  /** 단계 1: 사진 정리 */
  prepareBusy: '사진 정리하는 중',
  prepareDone: '사진 정리했어요',
  unknownError: '알 수 없는 오류',
  /** 단계 2: 글자 읽기(OCR) */
  ocrBusy: '글자를 찾는 중',
  ocrDone: (n: number) => `단어 ${n}개 읽었어요`,
  ocrSkipped: '글자 읽기 건너뜀',
  /** 단계 3: 묶어 번역 */
  translateMenuGrouping: '메뉴로 묶어 번역하는 중',
  translateMenuFound: (n: number) => `메뉴 ${n}개 찾았어요`,
  translateSignDone: (n: number) => `안내문 ${n}줄 번역했어요`,
  translateSignBusy: '안내문이에요 · 줄마다 번역하는 중',
  translateOtherDone: (n: number) => `${n}줄 번역했어요`,
  translateOtherBusy: '사진 속 글자예요 · 번역하는 중',
  translateUnknown: '무슨 글인지 보고 묶는 중',
  tipHeading: '기다리는 동안 한 가지',
  peek: '먼저 찾은 것부터 보기',
  /** lib/image.ts 의 오류(처리 중 화면의 실패 단계에 보인다) */
  imageLoadError: '이미지를 읽을 수 없어요. 다른 사진으로 시도해 주세요.',
  canvasError: '캔버스를 만들 수 없어요',
};
