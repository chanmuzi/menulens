/** lib 네임스페이스 문구(한국어). 키는 ja/lib.ts 와 같아야 한다 */
export const lib = {
  /** api.ts: 분석 스트림·환율 오류(처리 중 화면에 그대로 보인다) */
  modelError: '모델 응답 오류',
  /** OCR 이 글자를 못 찾았는데 지금 모델이 사진을 직접 읽지 못할 때(글자만 받는 모델로 배포한 경우) */
  noVision: '사진에서 글자를 찾지 못했어요. 지금 모델은 사진을 직접 읽을 수 없어서, 글자가 또렷하게 나온 사진이 필요해요',
  /** OCR 호출 자체가 실패했는데 모델이 사진을 직접 읽지 못할 때(사진 탓이 아니라 서버 쪽 문제) */
  ocrFailed: '글자 읽기 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요',
  rateFetchFailed: '환율을 가져오지 못했어요',
  /** history.ts: 옛 메뉴판 기록의 자동 제목 「가장 많은 분류 + 메뉴판」. 분류는 표시 이름(data.category) */
  oldMenuTitle: (category: string | null) => (category ? `${category} 메뉴판` : '메뉴판'),
};
