/**
 * 기록 목록 썸네일. 사진 가운데를 정사각으로 잘라 THUMB_PX 로 줄인 JPEG data URL(10KB 안팎).
 * 글자가 돌아간 사진(rotation)은 결과 화면처럼 세워서 만든다. 같은 스캔은 한 번만 만든다(저장이 여러 번 불려도).
 */
const THUMB_PX = 168; // 목록에서 56px 로 그린다(3배 화면까지 선명하게)
const QUALITY = 0.7;

const made = new Map<string, Promise<string | null>>();

const render = (dataUrl: string, rotation: number): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      if (side === 0) { resolve(null); return; }
      const c = document.createElement('canvas');
      c.width = THUMB_PX; c.height = THUMB_PX;
      const ctx = c.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.translate(THUMB_PX / 2, THUMB_PX / 2);
      ctx.rotate((-rotation * Math.PI) / 180);
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, -THUMB_PX / 2, -THUMB_PX / 2, THUMB_PX, THUMB_PX);
      resolve(c.toDataURL('image/jpeg', QUALITY));
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });

export const makeThumb = (id: string, dataUrl: string, rotation: number): Promise<string | null> => {
  if (!dataUrl) return Promise.resolve(null);
  const hit = made.get(id);
  if (hit) return hit;
  // 실패(null)는 기억하지 않는다: 다음 저장·채우기 때 다시 시도
  const p = render(dataUrl, rotation).then((t) => { if (!t) made.delete(id); return t; });
  made.set(id, p);
  return p;
};
