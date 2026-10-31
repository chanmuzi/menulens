/**
 * 문구 사전. 화면은 `const t = useT()` 로 받아 `t.home.title` 처럼 쓰고, React 밖(lib)은 호출 시점에 `dict().lib.xxx` 로 읽는다
 * (모듈 로드 시점에 읽어 상수로 두면 언어를 바꿔도 안 바뀐다). 매개변수가 있는 문구는 함수 `(n) => ...`.
 * 한국어 사전이 형(型)의 기준이고 일본어 사전은 같은 키를 전부 가져야 컴파일된다.
 */
import { ko } from './ko';
import { ja } from './ja';
import { getLang, useLang, type AppLang } from './lang';

export type Dict = typeof ko;
const DICTS: Readonly<Record<AppLang, Dict>> = { ko, ja };

export const dict = (lang: AppLang = getLang()): Dict => DICTS[lang];
export const useT = (): Dict => dict(useLang());
/** 태그 표시명. 사전에 없는 값(모델이 새로 낸 태그)은 그대로 보인다 */
export const tagLabel = (t: Dict, tag: string): string => (t.data.tag as Readonly<Record<string, string>>)[tag] ?? tag;
export { getLang, setLang, toggleLang, useLang, otherLang, detectLang, type AppLang } from './lang';
