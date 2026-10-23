/** 기록 시각 표기. 날짜는 「10/20」(올해가 아니면 「2025/10/20」) + 요일, 시각은 12시간제 「오후 2:57」 */
const startOfDay = (ts: number): number => new Date(ts).setHours(0, 0, 0, 0);
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const;

export const dayDiff = (ts: number, now: number = Date.now()): number => Math.round((startOfDay(now) - startOfDay(ts)) / 86400000);

/** 날짜 머리말: 날짜·요일·오늘/어제 배지를 따로 돌려준다(화면에서 글꼴을 달리 쓴다) */
export type DayHead = { readonly key: string; readonly date: string; readonly weekday: string; readonly badge: '오늘' | '어제' | null };
export const dayHead = (ts: number, now: number = Date.now()): DayHead => {
  const d = new Date(ts);
  const date = d.getFullYear() === new Date(now).getFullYear() ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  const diff = dayDiff(ts, now);
  return { key: `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, date, weekday: WEEKDAY[d.getDay()]!, badge: diff === 0 ? '오늘' : diff === 1 ? '어제' : null };
};

export const timeLabel = (ts: number): string => {
  const d = new Date(ts);
  const h = d.getHours();
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** 머리말 없는 목록(홈 최근 스캔)의 한 줄 표기: 「오늘 오후 2:57」「어제 …」「10/20(화) …」 */
export const whenLabel = (ts: number, now: number = Date.now()): string => {
  const h = dayHead(ts, now);
  return `${h.badge ?? `${h.date}(${h.weekday})`} ${timeLabel(ts)}`;
};
