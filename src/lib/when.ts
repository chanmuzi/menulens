/** 기록 시각 표기. 날짜는 「10/20」(올해가 아니면 「2025/10/20」) + 요일, 시각은 12시간제 「오후 2:57」 */
import { dict } from '../i18n';

const startOfDay = (ts: number): number => new Date(ts).setHours(0, 0, 0, 0);

export const dayDiff = (ts: number, now: number = Date.now()): number => Math.round((startOfDay(now) - startOfDay(ts)) / 86400000);

/** 날짜 머리말: 날짜·요일·오늘/어제 배지를 따로 돌려준다(화면에서 글꼴을 달리 쓴다). badge 는 언어별 문구라 오늘 여부는 isToday 로 본다 */
export type DayHead = { readonly key: string; readonly date: string; readonly weekday: string; readonly badge: string | null; readonly isToday: boolean };
export const dayHead = (ts: number, now: number = Date.now()): DayHead => {
  const d = new Date(ts);
  const date = d.getFullYear() === new Date(now).getFullYear() ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  const diff = dayDiff(ts, now);
  const { today, yesterday, weekday } = dict().data;
  return { key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, date, weekday: weekday[d.getDay()]!, badge: diff === 0 ? today : diff === 1 ? yesterday : null, isToday: diff === 0 };
};

export const timeLabel = (ts: number): string => {
  const d = new Date(ts);
  const h = d.getHours();
  const { am, pm } = dict().data;
  return `${h < 12 ? am : pm} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 머리말 없는 목록(홈 최근 스캔)의 한 줄 표기: 「오늘 오후 2:57」「어제 …」「10/20(화) …」 */
export const whenLabel = (ts: number, now: number = Date.now()): string => {
  const h = dayHead(ts, now);
  return `${h.badge ?? `${h.date}(${h.weekday})`} ${timeLabel(ts)}`;
};
