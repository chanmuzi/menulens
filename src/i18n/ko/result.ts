/** result 네임스페이스 문구(한국어): 결과 화면·오버레이·카드·안내문 패널·상세 시트·사진·사진 저장. 키는 ja/result.ts 와 같아야 한다 */
export const result = {
  /** 상단 보기 방식 세그먼트 */
  viewLabel: '보기 방식',
  viewOverlay: '오버레이',
  viewCards: '카드',
  /** 사진 저장 버튼과 결과 안내 */
  savePhotosAria: (n: number) => (n > 1 ? `사진 ${n}장을 기기에 저장` : '사진을 기기에 저장'),
  savePhotoTitle: '사진 저장',
  saveShared: (n: number) => `공유 시트에서 「이미지 저장」을 누르면 ${n > 1 ? `${n}장이 ` : ''}사진 앱에 들어가요`,
  saveOpened: (total: number) => `새 탭의 사진을 길게 눌러 저장하세요${total > 1 ? ' (첫 장만 열었어요. 나머지는 사진을 옮겨 가며 저장)' : ''}`,
  saveUnsupported: '이 브라우저에선 저장을 지원하지 않아요',
  /** 기록 이름 버튼 */
  renameAria: (title: string) => `${title}, 이름 고치기`,
  /** 제목 아래 요약 줄 */
  itemCount: (n: number) => `${n}개`,
  writingDesc: '설명 쓰는 중',
  writingNotice: '번역·요약 쓰는 중',
  marksOff: '표시 끄기',
  marksOn: '표시 켜기',
  /** 오버레이 번호 배지(메뉴판) */
  badgeAria: (n: number, name: string, price: string) => `${n}번 ${name} ${price}`,
  /** 안내문 덮개가 못 들어가 번호만 찍은 문단 */
  coverBadgeAria: (label: string, text: string) => `${label}번 ${text}`,
  /** 사진 확대를 되돌리는 버튼 */
  resetZoom: (zoom: string) => `원래대로 (${zoom}×)`,
  /** 카드 보기 */
  filterAll: '전체',
  filterSpicy: '매운맛',
  filtersAria: '묶음',
  /** 묶음 이름이 없는 항목의 묶음(groups.ts 의 REST) */
  groupRest: '그 밖에',
  repImage: '대표 이미지',
  photoPreparing: '사진은 준비 중',
  repImageKind: '대표 이미지 종류',
  modeArt: '그림',
  modePhoto: '사진',
  noMatch: '해당하는 메뉴가 없어요',
  taxIncluded: '세금 포함',
  /** 안내문 정리 영역 */
  tabSummary: '요약',
  tabTranslation: '번역문',
  tabOriginal: '원문',
  noticeSectionAria: '안내문 정리',
  noticeTabsLabel: '정리 보기',
  tipsHeading: '참고 · 사진에 없는 일반 정보',
  writingSummary: '요약 쓰는 중',
  copyOriginal: '원문 복사',
  /** 상세 시트 */
  addToOrder: '주문서에 담기',
  showWhenOrdering: '주문할 때 보여주세요',
  ask: '물어보기',
  /** 대표 이미지(사진 모드) */
  photoSearching: '사진 찾는 중',
  photoNone: '사진 없음',
};
