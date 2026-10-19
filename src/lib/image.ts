/** 촬영/선택한 이미지를 긴 변 기준으로 줄여 JPEG data URL 로 만든다 (업로드 비용·지연 절감). */

export type PreparedImage = {
  readonly dataUrl: string;
  readonly base64: string;
  readonly mediaType: 'image/jpeg';
  readonly width: number;
  readonly height: number;
};

const MAX_SIDE = 1280;
const QUALITY = 0.85;

const loadBitmap = async (file: File): Promise<ImageBitmap | HTMLImageElement> => {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('이미지를 읽을 수 없어요'));
      img.src = URL.createObjectURL(file);
    });
  }
};

export const prepareImage = async (file: File): Promise<PreparedImage> => {
  const src = await loadBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(src.width, src.height));
  const width = Math.round(src.width * scale);
  const height = Math.round(src.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없어요');
  ctx.drawImage(src, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
  return { dataUrl, base64: dataUrl.split(',')[1] ?? '', mediaType: 'image/jpeg', width, height };
};
