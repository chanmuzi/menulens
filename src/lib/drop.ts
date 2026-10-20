/** 드래그앤드롭 판별. clipboard.ts 의 paste 판별과 같은 모양으로, 화면 컴포넌트는 판별 없이 결과만 쓴다. */

/** 파일을 끌고 있는 이벤트인지 (텍스트·링크 드래그는 제외) */
export const hasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/** 드롭된 파일 중 첫 이미지. 없으면 null */
export const imageFromDropEvent = (e: DragEvent): File | null =>
  Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/')) ?? null;
