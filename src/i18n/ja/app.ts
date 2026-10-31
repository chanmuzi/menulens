import type { app as Ko } from '../ko/app';

/** app 네임스페이스 문구(日本語) */
export const app: typeof Ko = {
  noTextFound: '文字が見つかりませんでした。もっと近くで、明るく撮ってください。',
  removeTalkTitle: 'この会話を削除しますか？',
  removeTalkBody: (title) => `「${title}」の会話を削除すると元に戻せません。`,
  removeScanTitle: 'この履歴を削除しますか？',
  removeScanBody: (title, count) => `「${title}」${count > 1 ? `の写真${count}枚のセット` : 'の履歴'}を削除すると元に戻せません。`,
};
