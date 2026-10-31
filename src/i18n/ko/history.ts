/** history 네임스페이스 문구(한국어). 전체 기록 화면과 기록 한 줄(ScanRow·TalkRow). 키는 ja/history.ts 와 같아야 한다 */
export const history = {
  title: '전체 기록',
  count: (n: number) => `${n}건`,
  tabsAria: '기록 종류',
  tabPhotos: '사진',
  tabTalks: '대화',
  noTalks: '아직 대화 기록이 없어요',
  noScans: '아직 기록이 없어요',
  clearAllConfirm: (n: number) => `${n}건을 모두 지울까요?`,
  clearAll: '전체 지우기',
  retentionNote: '기록은 이 기기에만 저장되고 서버에는 남지 않아요. 브라우저 데이터를 지우거나, iPhone 의 Safari 에서 7일 넘게 열지 않으면 사라질 수 있어요.',
  /** 기록 한 줄의 버튼 라벨 */
  row: {
    openAria: (title: string) => `${title} 열기`,
    photoCountAria: (n: number) => `사진 ${n}장`,
    renameAria: (title: string) => `${title} 이름 고치기`,
    rename: '이름 고치기',
    removeAria: (title: string) => `${title} 지우기`,
    removeGroupAria: (title: string, n: number) => `${title} 묶음 ${n}장 지우기`,
    /** 대화 줄의 「대화 · 시각」 앞부분 */
    talkKind: '대화',
  },
};
