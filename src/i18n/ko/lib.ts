/** lib 네임스페이스 문구(한국어). 키는 ja/lib.ts 와 같아야 한다 */
export const lib = {
  /** api.ts: 분석 스트림·환율 오류(처리 중 화면에 그대로 보인다) */
  modelError: '모델 응답 오류',
  rateFetchFailed: '환율을 가져오지 못했어요',
  /** history.ts: 옛 메뉴판 기록의 자동 제목 「가장 많은 분류 + 메뉴판」. 분류는 표시 이름(data.category) */
  oldMenuTitle: (category: string | null) => (category ? `${category} 메뉴판` : '메뉴판'),
};
