/** 여러 화면이 같이 쓰는 짧은 문구(한국어). 화면 전용 문구는 각 네임스페이스에 */
export const common = {
  back: '뒤로',
  close: '닫기',
  cancel: '취소',
  confirm: '확인',
  remove: '지우기',
  save: '저장',
  copy: '복사',
  copied: '복사했어요',
  retry: '다시 시도',
  home: '홈으로',
  showAll: '전체 보기',
  edit: '고치기',
  done: '완료',
  more: '더 보기',
  /** 서버 오류(분석·챗·통역 공용) */
  accessCodeInvalid: '초대 코드가 더 이상 유효하지 않아요',
  serverError: (status: number) => `서버 오류 (${status})`,
  emptyResponse: '응답이 비어 있어요',
  /** 홈 오른쪽 위 언어 버튼: 지금 방향 표시와 누르면 바뀔 언어 */
  langButton: '日本語 → 한국어',
  langButtonAria: '앱 언어: 한국어. 누르면 日本語로 바꿉니다',
};
