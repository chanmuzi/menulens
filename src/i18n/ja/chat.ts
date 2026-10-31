import type { chat as Ko } from '../ko/chat';

/** chat 네임스페이스 문구(日本語) */
export const chat: typeof Ko = {
  title: { menu: 'メニューに質問', sign: '案内に質問', other: '写真に質問' },
  newAnswers: (n) => `新しい回答 ${n}件`,
  disconnected: '(画面を離れたため回答が途切れました。もう一度聞いてください)',
  notFoundWithPhoto: '写真を見ても見つかりませんでした',
  noPhoto: '写真がないため答えられません',
  photoCount: (n) => `写真 ${n}枚`,
  focusPrefix: '今見ている: ',
  clearFocus: '文脈を外す',
  intro: (photos) => `${photos > 1 ? `写真${photos}枚から` : ''}読み取った文字でまず答え、写真を見直す必要があればそう表示します。`,
  sawPhoto: (photo) => `${photo ? `${photo}枚目の写真を` : '写真を'}見直しました`,
  textOnly: '文字だけで回答',
  rePhoto: (photo) => `${photo ? `${photo}枚目の写真を` : '写真を'}見直し中`,
  thinking: '考え中',
  photoN: (n) => `写真 ${n}`,
  placeholderMore: 'さらに質問',
  placeholderFirst: '気になることを聞いてください',
  inputAria: '質問',
  send: '送信',
  cutOff: '回答が途切れました',
};
