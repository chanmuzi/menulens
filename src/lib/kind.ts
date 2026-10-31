/** 스캔 종류(메뉴판·안내문·기타)별 화면 문구. 여러 화면이 같은 이름을 쓰도록 한곳에 둔다. 문구는 호출 시점의 앱 언어 사전에서 읽는다. */
import type { ScanKind } from '../types';
import { dict } from '../i18n';

/** 종류 이름(앱 언어) */
export const kindLabel = (kind: ScanKind): string => dict().data.kind[kind];

/** 챗 버튼·시트 제목. 메뉴판이 아닐 때 「메뉴판에 물어보기」라고 하지 않는다 */
export const chatTitle = (kind: ScanKind): string => dict().chat.title[kind];
