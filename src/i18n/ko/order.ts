/** order 네임스페이스 문구(한국어): 주문서 시트·OrderBar·QtyStepper·order.ts. 키는 ja/order.ts 와 같아야 한다 */
export const order = {
  /** 하단 바 */
  barTitle: (n: number) => `주문서 · ${n}개`,
  orderPhrase: '주문 문구',
  /** 시트 */
  title: '주문서',
  countSuffix: (n: number) => `${n}개`,
  clear: '비우기',
  photoN: (n: number) => `사진 ${n}`,
  total: '합계',
  excludeNoPrice: '(가격 미표기 제외)',
  showStaff: '직원에게 보여주세요',
  modeLabel: '주문 상황',
  /** 직원에게 보여줄 문구 복사(ko 모드는 일본어, ja 모드는 한국어) */
  copyPhrase: '일본어 복사',
  showBig: '크게 보여주기',
  bigAria: '직원에게 보여주기',
  backFromBig: '돌아가기',
  /** 상황(첫 주문·추가 주문·항목만) */
  modes: { first: '첫 주문', more: '추가 주문', plain: '항목만' },
  /** 수량 스테퍼 aria */
  qtyGroup: (label: string) => `${label} 수량`,
  minusOne: (label: string) => `${label} 하나 빼기`,
  add: (label: string) => `${label} 담기`,
  plusOne: (label: string) => `${label} 하나 더`,
};
