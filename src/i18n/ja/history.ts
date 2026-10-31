import type { history as Ko } from '../ko/history';

/** history 네임스페이스 문구(日本語) */
export const history: typeof Ko = {
  title: 'すべての記録',
  count: (n: number) => `${n}件`,
  tabsAria: '記録の種類',
  tabPhotos: '写真',
  tabTalks: '会話',
  noTalks: 'まだ会話の記録がありません',
  noScans: 'まだ記録がありません',
  clearAllConfirm: (n: number) => `${n}件をすべて削除しますか?`,
  clearAll: 'すべて削除',
  retentionNote: '記録はこの端末にのみ保存され、サーバーには残りません。ブラウザのデータを消したり、iPhone の Safari で7日以上開かないと消えることがあります。',
  row: {
    openAria: (title: string) => `${title} を開く`,
    photoCountAria: (n: number) => `写真 ${n}枚`,
    renameAria: (title: string) => `${title} の名前を変更`,
    rename: '名前を変更',
    removeAria: (title: string) => `${title} を削除`,
    removeGroupAria: (title: string, n: number) => `${title} のまとめ ${n}枚を削除`,
    talkKind: '会話',
  },
};
