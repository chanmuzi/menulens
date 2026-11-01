import type { order as Ko } from '../ko/order';

/** order 네임스페이스 문구(日本語) */
export const order: typeof Ko = {
  barTitle: (n) => `注文リスト · ${n}品`,
  orderPhrase: '注文フレーズ',
  title: '注文リスト',
  countSuffix: (n) => `${n}品`,
  clear: '空にする',
  photoN: (n) => `写真 ${n}`,
  total: '合計',
  excludeNoPrice: '(価格表示なしを除く)',
  showStaff: '店員に見せてください',
  modeLabel: '注文の状況',
  copyPhrase: (src) => (src === 'ja' ? '日本語をコピー' : '韓国語をコピー'),
  showBig: '大きく見せる',
  bigAria: '店員に見せる',
  backFromBig: '戻る',
  modes: { first: '最初の注文', more: '追加注文', plain: '品目のみ' },
  frames: {
    first: { head: 'すみません、注文お願いします。', tail: '以上です。' },
    more: { head: 'すみません、追加で注文お願いします。', tail: '以上です。' },
    plain: { head: '', tail: 'お願いします。' },
    sep: '、',
    end: '。',
  },
  oneOrder: (tr) => `「${tr}を1つください」`,
  qtyGroup: (label) => `${label} の数量`,
  minusOne: (label) => `${label} を1つ減らす`,
  add: (label) => `${label} を追加`,
  plusOne: (label) => `${label} をもう1つ`,
};
