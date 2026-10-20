/** 기록 시각 표기. 오늘은 시각, 어제, 올해는 M/D, 그 전은 YYYY/M/D */
const startOfDay = (ts: number): number => new Date(ts).setHours(0, 0, 0, 0);

export const dayDiff = (ts: number, now: number = Date.now()): number => Math.round((startOfDay(now) - startOfDay(ts)) / 86400000);

/** 날짜 라벨 (목록 묶음 제목용) */
export const dayLabel = (ts: number, now: number = Date.now()): string => {
  const diff = dayDiff(ts, now);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  const d = new Date(ts);
  return d.getFullYear() === new Date(now).getFullYear() ? `${d.getMonth() + 1}/${d.getDate()}` : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};

export const timeLabel = (ts: number): string => new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

/** 한 줄 표기: 오늘이면 「오늘 14:05」, 아니면 날짜 라벨 */
export const whenLabel = (ts: number, now: number = Date.now()): string => (dayDiff(ts, now) === 0 ? `오늘 ${timeLabel(ts)}` : dayLabel(ts, now));
