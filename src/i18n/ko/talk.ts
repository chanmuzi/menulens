/** talk 네임스페이스 문구(한국어). 키는 ja/talk.ts 와 같아야 한다 */
export const talk = {
  /** 말하기 버튼·받아 적기 상태. ko = 내 쪽(주홍) 버튼, ja = 상대 쪽(먹) 버튼. live 는 상대가 보는 글이라 상대 언어로 */
  mic: {
    ko: { label: '한국어', live: '듣는 중', status: '한국어 듣는 중 · 다 말하면 저절로 끝나요 · 누르면 바로 끝', hearing: '한국어 받아 적는 중' },
    ja: { label: '日本語', live: '聞いています', status: '일본어 듣는 중 · 다 말하면 저절로 끝나요 · 누르면 바로 끝', hearing: '일본어 받아 적는 중' },
  },
  /** 다시 될 때까지 남은 시간 → 「40초」「12분」「2시간」 */
  wait: {
    seconds: (n: number) => `${n}초`,
    minutes: (n: number) => `${n}분`,
    hours: (n: number) => `${n}시간`,
  },
  sttLimited: (wait: string) => `음성 인식 한도에 걸렸어요 · ${wait} 뒤 다시 돼요 · 글로 쓰기는 지금도 돼요`,
  sttUnavailable: '지금은 음성 인식을 쓸 수 없어요 · 관리자에게 문의해 주세요 · 글로 쓰기는 돼요',
  noRecorder: '이 브라우저는 녹음을 지원하지 않아요 · 글로 써 주세요',
  micDenied: '마이크를 쓸 수 없어요 · 설정에서 이 앱의 마이크 권한을 허용해 주세요',
  nothingHeard: '말소리가 들리지 않았어요 · 다시 눌러 말해 주세요',
  notUnderstood: '알아듣지 못했어요 · 다시 말해 주세요',
  sttFailed: (reason: string) => `음성 인식에 실패했어요 · ${reason}`,
  /** 머리글 */
  renameAria: (title: string) => `${title} 이름 고치기`,
  pairAria: (name: string) => `말풍선 언어: ${name}`,
  pairMenuTitle: '말풍선에 보일 두 언어',
  pairDefault: '기본',
  /** 표시 언어 쌍의 짧은 라벨(버튼)과 이름(메뉴) */
  pairLabel: { 'ko-ja': '한·日', 'ko-en': '한·EN', 'ja-en': '日·EN' },
  pairName: { 'ko-ja': '한국어 · 日本語', 'ko-en': '한국어 · English', 'ja-en': '日本語 · English' },
  pronToggle: '일본어 발음 보기',
  on: '켬',
  off: '끔',
  helperTitle: '도우미',
  helperAsk: '도우미에게 묻기',
  /** 본문 */
  intro: '「한국어」를 누르고 말하면 일본어로 바꿔 보여줘요. 상대가 말할 땐 「日本語」를 눌러 주세요. 다 말하고 조용해지면 저절로 끝나요.',
  tapToShow: '내 말풍선을 누르면 상대에게 크게 보여줘요',
  /** 아래 입력 */
  writeMode: '글로 쓰기',
  backToVoice: '말하기로 돌아가기',
  inputPlaceholder: '한국어나 일본어로 쓰기',
  inputAria: '번역할 글',
  sendTranslate: '번역해서 보내기',
  /** 도우미 시트 */
  helperHidden: '상대에게는 보이지 않아요',
  helperIntro: '지금까지 나눈 대화를 보고 답해요. 상대에게 바로 묻기 애매한 걸 물어보세요.',
  sayLabel: '말해 볼 문장',
  sayInsert: '대화에 넣고 보여주기',
  thinking: '생각 중',
  helperPlaceholder: '궁금한 걸 물어보세요',
  send: '보내기',
  /** 말풍선 */
  helperSuggested: '도우미가 추천한 문장',
  translateFailed: '번역하지 못했어요',
  translating: '번역 중',
  showBigAria: (text: string) => `${text} 크게 보여주기`,
  retryTranslate: '다시 번역',
  /** 크게 보여주기 */
  showBigTitle: '상대에게 크게 보여주기',
  myPron: '내가 읽을 발음',
  /** 제목·목록 부제 */
  newTalk: '새 대화',
  noTurns: '아직 나눈 말이 없어요',
  /** 서버 호출 오류 */
  responseError: '응답 오류',
  translationCut: '번역이 끊겼어요',
  answerCut: '답이 끊겼어요',
};
