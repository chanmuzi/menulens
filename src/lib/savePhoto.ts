/**
 * 촬영한 사진을 기기 사진 앱에 저장한다.
 * 웹은 갤러리에 직접 쓸 수 없으므로 공유 시트(navigator.share)를 띄운다. iOS 에서는 거기서 「이미지 저장」을 고른다.
 * 공유 시트를 지원하지 않으면 새 탭에 이미지를 열어 길게 눌러 저장하게 한다.
 */
const dataUrlToFile = async (dataUrl: string, name: string): Promise<File> => {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
};

export type SaveResult = 'shared' | 'opened' | 'cancelled' | 'unsupported';

export const savePhoto = async (original: File | null, dataUrl: string): Promise<SaveResult> => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const file = original ?? (await dataUrlToFile(dataUrl, `menulens-${stamp}.jpg`));
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({ files: [file], title: 'MenuLens' });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // 공유 실패 시 새 탭 방식으로 폴백
    }
  }
  const url = URL.createObjectURL(file);
  const w = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return w ? 'opened' : 'unsupported';
};
