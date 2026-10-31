/** 대기 화면에 돌아가며 보여주는 식당·표기 상식. 문구는 사전(tips 네임스페이스)에 있고, 호출 시점의 앱 언어를 따른다. */
import { dict } from '../i18n';

/** 메뉴판을 읽는 동안의 식당 상식 */
export const menuTips = (): readonly string[] => dict().tips.menu;
/** 안내문·표지판을 읽는 동안의 거리·가게 표기 상식. 메뉴 상식은 이때 어울리지 않는다 */
export const signTips = (): readonly string[] => dict().tips.sign;

const pickFrom = (list: readonly string[], seed: number): string => list[Math.abs(seed) % list.length] ?? list[0]!;
export const pickTip = (seed: number): string => pickFrom(menuTips(), seed);
export const pickSignTip = (seed: number): string => pickFrom(signTips(), seed);
