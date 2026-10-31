import type { processing as Ko } from '../ko/processing';

/** processing 네임스페이스 문구(日本語) */
export const processing: typeof Ko = {
  title: { unknown: '読み取り中', menu: 'メニューを読み取り中', sign: '案内を読み取り中', other: '文字を読み取り中' },
  failedTitle: '読み取れませんでした',
  cancelHome: 'キャンセルしてホームへ',
  progressMenuAria: (n: number) => `メニュー ${n}件`,
  progressTranslating: '翻訳中',
  prepareBusy: '写真を整理中',
  prepareDone: '写真を整理しました',
  unknownError: '不明なエラー',
  ocrBusy: '文字を探しています',
  ocrDone: (n: number) => `単語を${n}個読みました`,
  ocrSkipped: '文字の読み取りをスキップ',
  translateMenuGrouping: 'メニューにまとめて翻訳中',
  translateMenuFound: (n: number) => `メニューを${n}件見つけました`,
  translateSignDone: (n: number) => `案内を${n}行翻訳しました`,
  translateSignBusy: '案内です · 行ごとに翻訳中',
  translateOtherDone: (n: number) => `${n}行翻訳しました`,
  translateOtherBusy: '写真の文字です · 翻訳中',
  translateUnknown: '内容を見てまとめています',
  tipHeading: '待っている間にひとつ',
  peek: '見つかったものから先に見る',
  imageLoadError: '画像を読み込めません。別の写真でお試しください。',
  canvasError: 'キャンバスを作成できません',
};
