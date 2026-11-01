import type { lib as Ko } from '../ko/lib';

/** lib 네임스페이스 문구(日本語) */
export const lib: typeof Ko = {
  modelError: 'モデルの応答エラー',
  noVision: '写真から文字を見つけられませんでした。いまのモデルは写真を直接読めないため、文字がはっきり写った写真が必要です',
  ocrFailed: '文字読み取りサーバーに接続できませんでした。しばらくしてからもう一度お試しください',
  rateFetchFailed: '為替レートを取得できませんでした',
  oldMenuTitle: (category) => (category ? `${category}メニュー` : 'メニュー'),
};
