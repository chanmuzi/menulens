/** home 네임스페이스 문구(한국어). 홈·초대 코드(게이트)·홈 화면 추가 안내. 키는 ja/home.ts 와 같아야 한다 */
export const home = {
  /** 붙여넣기 버튼이 실패했을 때 이유별 안내(clipboard.ts 의 reason 과 같은 키) */
  pasteHint: {
    empty: '클립보드에 이미지가 없어요',
    denied: '붙여넣기가 허용되지 않았어요 · 앨범에서 골라 주세요',
    unsupported: '이 브라우저는 붙여넣기를 지원하지 않아요',
  } as Readonly<Record<'empty' | 'denied' | 'unsupported', string>>,
  dropOnlyImage: '이미지 파일만 넣을 수 있어요',
  tabsAria: '기능',
  tabMenu: '사진 읽기',
  tabTalk: '대화 통역',
  /** 대화 통역 탭 제목(두 줄) */
  talkTitle1: '말하거나 쓰면 일본어로,',
  talkTitle2: '들으면 한국어로 보여드려요',
  newTalk: '새 대화 시작',
  recentTalks: '최근 대화',
  showAllCount: (n: number) => `전체 보기 (${n}) ›`,
  /** 사진 읽기 탭 제목(두 줄) */
  menuTitle1: '메뉴판이나 안내문을 찍으면',
  menuTitle2: '바로 읽어드려요',
  dropHere: '여기에 놓으면 확인 화면으로 가요',
  albumButton: '앨범에서',
  cameraButton: '촬영',
  pasteButton: '붙여넣기',
  pasteLongPressAria: '길게 눌러 붙여넣기',
  pasteLongPressHint: '버튼을 길게 눌러 「붙여넣기」를 고르세요',
  cameraInputAria: '카메라로 촬영',
  albumInputAria: '앨범에서 선택',
  recentScans: '최근 스캔',
  /** iOS 홈 화면 앱에서 clipboard.read 가 막혔을 때의 붙여넣기 상자. 가운데는 굵게 */
  pasteBoxBefore: '붙여넣기 권한이 막혀 있어요. 아래 상자를 ',
  pasteBoxStrong: '길게 눌러 「붙여넣기」',
  pasteBoxAfter: '를 고르세요',
  pasteBoxAria: '붙여넣기 상자',
  pasteBoxLongPress: '여기를 길게 누르기',
  /** 대화 통역 모형(장식): 내 말 원문·번역, 상대 말 원문·번역 */
  talkMock: {
    mineSrc: '그럼 하나 부탁할게요',
    mineDst: 'じゃあ、一つお願いします',
    otherSrc: 'お水はセルフサービスになっております',
    otherDst: '물은 셀프서비스입니다.',
  },
  /** 메뉴판 모형(장식)의 번역 칩 */
  menuMockItem: '라멘',
  menuMockPrice: '¥900',
  /** 초대 코드 화면 */
  gate: {
    wrongCode: '맞지 않는 코드예요. 다시 확인해 주세요.',
    serverError: '서버에 연결하지 못했어요.',
    codeLabel: '초대 코드',
    codePlaceholder: '받은 코드를 입력해 주세요',
    checking: '확인 중…',
    enter: '들어가기',
    note: '초대받은 분만 쓸 수 있어요. 코드는 이 기기에 저장되어 다음부터 묻지 않아요.',
  },
  /** 「홈 화면에 추가」 안내 */
  install: {
    hint: '홈 화면에 추가하면 앱처럼 열리고 기록도 지워지지 않아요',
    add: '추가',
    how: '방법',
    dismissAria: '안내 닫기',
    iosStep1Before: 'Safari 아래쪽 ',
    iosStep1Strong: '공유',
    iosStep1After: ' 버튼(네모에 화살표)을 누르고',
    iosStep2Strong: '홈 화면에 추가',
    iosStep2After: '를 고른 뒤 「추가」',
  },
};
