import type { common as Ko } from '../ko/common';

export const common: typeof Ko = {
  back: '戻る',
  close: '閉じる',
  cancel: 'キャンセル',
  confirm: 'OK',
  remove: '削除',
  save: '保存',
  copy: 'コピー',
  copied: 'コピーしました',
  retry: 'もう一度',
  home: 'ホームへ',
  showAll: 'すべて見る',
  edit: '編集',
  done: '完了',
  more: 'もっと見る',
  accessCodeInvalid: '招待コードが無効になりました',
  serverError: (status) => `サーバーエラー (${status})`,
  emptyResponse: '応答が空です',
  langButton: '한국어 → 日本語',
  langButtonAria: 'アプリの言語: 日本語。押すと한국어に切り替えます',
};
