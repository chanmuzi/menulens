/** confirm 네임스페이스 문구(한국어). 사진 모음·영역 자르기·묶음 띠·나가기 확인·확인/이름 고치기 팝업. 키는 ja/confirm.ts 와 같아야 한다 */
export const confirm = {
  /** 사진 모음 확인 화면 */
  batch: {
    quit: '그만두기',
    collected: (n: number) => `${n}장 모았어요`,
    tapToCrop: '사진을 누르면 영역을 잘라요',
    cropPhotoAria: (i: number) => `사진 ${i} 영역 자르기`,
    removePhotoAria: (i: number) => `사진 ${i} 빼기`,
    reading: '읽는 중',
    moveForwardAria: (i: number) => `사진 ${i} 앞으로`,
    cropAria: (i: number) => `사진 ${i} 자르기`,
    crop: '자르기',
    moveBackAria: (i: number) => `사진 ${i} 뒤로`,
    takeMore: '더 찍기',
    addFromAlbum: '앨범에서 추가',
    limit: (n: number) => `한 번에 ${n}장까지예요.`,
    dropped: (n: number) => `뒤의 ${n}장은 뺐어요.`,
    cameraMoreAria: '카메라로 더 찍기',
    analyze: (n: number) => `${n}장 분석하기`,
  },
  /** 영역 지정 화면과 상자 */
  crop: {
    backToBatch: '모음으로',
    title: '영역을 잘라요',
    imageAlt: '고른 사진',
    onlyRed: '빨간 영역만 분석해요',
    dragHint: '모서리를 끌면 글자 부분만 남길 수 있어요',
    resetFull: '전체로',
    cropping: '잘라내는 중…',
    useArea: '이 영역만 쓰기',
    useWhole: '그대로 쓰기',
    handleAria: (h: string) => `영역 ${h}`,
    boxAria: '영역 지정',
    /** lib/crop.ts 의 오류(화면에 그대로 보인다) */
    canvasError: '캔버스를 만들 수 없어요',
    cropFailed: '사진을 잘라내지 못했어요',
  },
  /** 여러 장 묶음의 썸네일 띠 */
  strip: {
    groupAria: '묶음 사진',
    statusAria: (i: number, status: string) => `사진 ${i} ${status}`,
    failed: '실패',
    takeMoreAria: '사진 더 찍기',
  },
  /** 읽는 중 홈으로 나가기 확인 */
  leave: {
    titleDetailing: '설명을 아직 쓰는 중이에요',
    titleReading: (n: number) => `사진 ${n}장을 아직 읽는 중이에요`,
    bodyDetailing: '지금 나가면 메뉴 설명이 비어 있는 채로 남아요.',
    bodyReading: '지금 나가면 읽기를 멈추고, 읽던 사진은 기록에 남지 않아요.',
    stay: '계속 읽기',
    leave: '중단하고 홈으로',
  },
  /** 기록 이름 고치기 팝업 */
  rename: {
    title: '이름 고치기',
    nameLabel: '이름',
    autoTitle: (auto: string) => `자동 제목: ${auto}`,
    useAuto: '자동 제목으로',
  },
};
