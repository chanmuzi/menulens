/**
 * 촬영/선택한 이미지를 긴 변 기준으로 줄여 JPEG data URL 로 만든다 (업로드 비용·지연 절감).
 * EXIF 방향은 <img> 디코딩 경로로 바로잡는다. createImageBitmap 의 imageOrientation 옵션은
 * Safari 에서 신뢰할 수 없어 쓰지 않는다. 모든 최신 브라우저는 <img> → canvas.drawImage 에서 EXIF 를 적용한다.
 */

export type PreparedImage = {
  readonly dataUrl: string;
  readonly base64: string;
  readonly mediaType: 'image/jpeg';
  readonly width: number;
  readonly height: number;
};

const MAX_SIDE = 1280;
const QUALITY = 0.85;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽을 수 없어요. 다른 사진으로 시도해 주세요.')); };
    img.src = url;
  });

export const prepareImage = async (file: File): Promise<PreparedImage> => {
  const img = await loadImage(file);
  // naturalWidth/Height 는 EXIF 가 적용된 표시 크기 (Safari 13.1+, Chrome 81+)
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없어요');
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  return { dataUrl, base64: dataUrl.split(',')[1] ?? '', mediaType: 'image/jpeg', width, height };
};
