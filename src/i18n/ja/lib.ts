import type { lib as Ko } from '../ko/lib';

/** lib 네임스페이스 문구(日本語) */
export const lib: typeof Ko = {
  modelError: 'モデルの応答エラー',
  rateFetchFailed: '為替レートを取得できませんでした',
  oldMenuTitle: (category) => (category ? `${category}メニュー` : 'メニュー'),
};
