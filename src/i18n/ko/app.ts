/** app 네임스페이스 문구(한국어). 키는 ja/app.ts 와 같아야 한다 */
export const app = {
  /** 읽기가 끝났는데 항목도 문단도 없을 때의 스캔 오류 */
  noTextFound: '글자를 찾지 못했어요. 더 가까이, 밝게 찍어 주세요.',
  /** 대화 지우기 확인 */
  removeTalkTitle: '이 대화를 지울까요?',
  removeTalkBody: (title: string) => `「${title}」 대화를 지우면 되돌릴 수 없어요.`,
  /** 기록 지우기 확인(묶음이면 장수를 적는다) */
  removeScanTitle: '이 기록을 지울까요?',
  removeScanBody: (title: string, count: number) => `「${title}」${count > 1 ? ` 사진 ${count}장 묶음` : ' 기록'}을 지우면 되돌릴 수 없어요.`,
};
