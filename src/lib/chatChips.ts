/** 챗 칩 문구 정책: 종류별 제목, 사진 내용에 맞는 질문 + 종류별 풀에서 섞기. 네트워크·저장은 chat.ts */
import type { Scan, ScanKind } from '../types';

/** 버튼·팝업 제목. 메뉴판이 아닐 때 「메뉴판에 물어보기」라고 하지 않는다 */
export const chatTitle = (kind: ScanKind): string => ({ menu: '메뉴판에 물어보기', sign: '안내문에 물어보기', other: '사진에 물어보기' })[kind];

/** 종류별 질문 풀. 앞의 contextual 은 지금 사진에 맞을 때만 들어가고, 나머지에서 섞어 채운다 */
const POOL: Readonly<Record<ScanKind, readonly string[]>> = {
  menu: ['대표 메뉴가 뭐야?', '둘이서 뭐 시켜?', '혼자 먹기 좋은 건?', '제일 싼 거 뭐야?', '처음 와서 뭐부터 시켜?', '주문할 때 뭐라고 말해?', '내가 놓친 정보 있어?', '양은 어느 정도야?'],
  sign: ['이게 무슨 뜻이야?', '지금 내가 해야 할 게 있어?', '하면 안 되는 게 뭐야?', '내가 놓친 정보 있어?', '한 줄로 요약해줘', '숫자나 시간이 뭘 뜻해?'],
  other: ['이게 무슨 뜻이야?', '어떻게 쓰는 거야?', '주의할 점 있어?', '내가 놓친 정보 있어?', '한 줄로 요약해줘', '숫자나 날짜가 뭘 뜻해?'],
};
/** 사진 내용에 맞을 때만 앞에 끼우는 질문: [조건, 질문] */
const contextual = (scan: Scan, hasFocus: boolean): readonly string[] => {
  const text = [...scan.notes.map((n) => n.text_ja), ...scan.items.map((it) => it.name_ja)].join(' ');
  const tags = new Set(scan.items.flatMap((it) => it.tags));
  const picks: readonly (readonly [boolean, string])[] = scan.kind === 'menu'
    ? [
        [hasFocus, '이 메뉴 뭐야?'],
        [tags.has('매움'), '안 매운 거 추천해줘'],
        [/お通し|席料|チャージ/.test(text), '자릿세나 추가 요금 있어?'],
        [/税込|税抜|税別/.test(text), '세금 포함 가격이야?'],
        [scan.items.some((it) => it.category === '음료'), '술이랑 어울리는 안주는?'],
        [/飲み放題|食べ放題/.test(text), '무제한 조건이 뭐야?'],
      ]
    : [
        [/営業|開店|閉店|休|時間/.test(text), '영업시간이나 휴무일 적혀 있어?'],
        [/禁止|禁煙|ご遠慮|お断り/.test(text), '하면 안 되는 게 뭐야?'],
        [/円|¥|料金|無料/.test(text), '돈 내야 하는 거야?'],
        [/列|並|順番|予約/.test(text), '줄 서거나 예약해야 해?'],
      ];
  return picks.filter(([ok]) => ok).map(([, q]) => q);
};
/** 결정적 섞기(같은 seed 면 같은 순서). 「다른 질문」을 누를 때마다 seed 를 올린다 */
const shuffled = <T,>(list: readonly T[], seed: number): readonly T[] => {
  let x = (seed * 2654435761 + 1013904223) >>> 0;
  const next = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
  return out;
};
/** 칩 3개: 사진에 맞는 질문 최대 2개 + 풀에서 섞어 채움. seed 가 바뀌면 다른 조합 */
export const quickQuestions = (scan: Scan, hasFocus: boolean, seed: number): readonly string[] => {
  // 「이 메뉴 뭐야?」는 보는 항목이 있으면 항상 맨 앞이고, 맞춤 몫 2개 중 하나로 센다(풀 질문이 하나는 남게)
  const first = hasFocus && scan.kind === 'menu' ? ['이 메뉴 뭐야?'] : [];
  const ctx = shuffled(contextual(scan, hasFocus).filter((q) => !first.includes(q)), seed).slice(0, 2 - first.length);
  const rest = shuffled(POOL[scan.kind].filter((q) => !ctx.includes(q) && !first.includes(q)), seed + 7);
  return [...first, ...ctx, ...rest].filter((q, i, a) => a.indexOf(q) === i).slice(0, 3);
};

/** 「다른 질문」: 칩 구성이 실제로 바뀌는 다음 seed. 조합이 하나뿐이면 12번 안에 포기하고 그냥 넘긴다 */
export const nextSeed = (scan: Scan, hasFocus: boolean, seed: number): number => {
  const key = (s: number) => [...quickQuestions(scan, hasFocus, s)].sort().join('|');
  const cur = key(seed);
  let m = seed + 1;
  for (let i = 0; i < 12 && key(m) === cur; i++) m++;
  return m;
};

