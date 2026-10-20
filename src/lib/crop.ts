/** 확인 화면의 영역 지정. 좌표는 표시된 사진 기준 0~1 정규화. 잘라낸 결과는 새 File 로 만들어 기존 분석 경로에 그대로 넣는다. */
import { loadImage } from './image';

export type CropRect = { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };

export const FULL_RECT: CropRect = { x0: 0, y0: 0, x1: 1, y1: 1 };

/** 너무 작은 영역은 못 만들게 하는 한 변의 최소 비율 */
export const MIN_SIDE = 0.08;

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/** 네 변을 0~1 로 자르고 최소 크기를 보장한다 (움직인 변 쪽을 되민다) */
export const normalizeRect = (r: CropRect): CropRect => {
  const x0 = clamp01(Math.min(r.x0, r.x1)), x1 = clamp01(Math.max(r.x0, r.x1));
  const y0 = clamp01(Math.min(r.y0, r.y1)), y1 = clamp01(Math.max(r.y0, r.y1));
  return { x0, y0, x1: Math.max(x1, Math.min(1, x0 + MIN_SIDE)), y1: Math.max(y1, Math.min(1, y0 + MIN_SIDE)) };
};

export const isFullRect = (r: CropRect): boolean => r.x0 <= 0.005 && r.y0 <= 0.005 && r.x1 >= 0.995 && r.y1 >= 0.995;

/** 잘라낸 결과의 긴 변 상한. prepareImage 가 어차피 1280 으로 줄이므로 여유 있게 */
const MAX_OUT = 2560;
const QUALITY = 0.92;

/** 사진에서 rect 영역만 잘라 JPEG File 로 돌려준다. EXIF 방향은 <img> 디코딩에서 이미 적용된다. */
export const cropFile = async (file: File, rect: CropRect): Promise<File> => {
  const img = await loadImage(file);
  const srcW = img.naturalWidth || img.width, srcH = img.naturalHeight || img.height;
  const sx = Math.round(rect.x0 * srcW), sy = Math.round(rect.y0 * srcH);
  const sw = Math.max(1, Math.round((rect.x1 - rect.x0) * srcW)), sh = Math.max(1, Math.round((rect.y1 - rect.y0) * srcH));
  const scale = Math.min(1, MAX_OUT / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스를 만들 수 없어요');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('사진을 잘라내지 못했어요');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '-crop.jpg', { type: 'image/jpeg' });
};
