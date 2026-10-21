/** 스캔 종류(메뉴판·안내문·기타)별 화면 문구. 여러 화면이 같은 이름을 쓰도록 한곳에 둔다. */
import type { ScanKind } from '../types';

/** 한글 이름 */
export const KIND_LABEL: Readonly<Record<ScanKind, string>> = { menu: '메뉴판', sign: '안내문', other: '사진 속 글자' };

/** 메뉴판이 아닌 스캔의 줄 수 요약: 「안내문 · 3줄」 */
export const lineSummary = (kind: ScanKind, lines: number): string => `${KIND_LABEL[kind]} · ${lines}줄`;
