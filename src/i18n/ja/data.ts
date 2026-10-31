import type { data as Ko } from '../ko/data';

export const data: typeof Ko = {
  category: { 안주: 'おつまみ', 식사: '食事', 음료: '飲み物', 디저트: 'デザート', 기타: 'その他' },
  tag: { 인기: '人気', 날것: '生もの', 매움: '辛い', 튀김: '揚げ物', 음료: '飲み物', 채식: 'ベジ', '선택 필요': '要選択' },
  kind: { menu: 'メニュー', sign: '案内', other: '写真の文字' },
  noteRole: { title: 'タイトル', body: '本文', label: 'ラベル' },
  today: '今日',
  yesterday: '昨日',
  weekday: ['日', '月', '火', '水', '木', '金', '土'],
  am: '午前',
  pm: '午後',
  noPrice: '価格表示なし',
};
