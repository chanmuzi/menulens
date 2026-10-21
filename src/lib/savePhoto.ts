/**
 * 찍은 사진을 기기 사진 앱에 저장한다. 여러 장 묶음이면 전부 한 번에.
 * 웹은 갤러리에 직접 쓸 수 없으므로 공유 시트(navigator.share)에 파일들을 넘긴다. iOS 에서는 거기서 「이미지 저장」을 고른다.
 * 공유 시트를 지원하지 않으면 새 탭에 이미지를 열어 길게 눌러 저장하게 한다(이 경로는 한 장씩).
 */
const dataUrlToFile = async (dataUrl: string, name: string): Promise<File> => {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || 'image/jpeg' });
};

/** shared: 공유 시트로 n장 · opened: 새 탭에 첫 장만(팝업은 클릭당 하나) · cancelled · unsupported */
export type SaveResult = { readonly kind: 'shared'; readonly count: number } | { readonly kind: 'opened'; readonly total: number } | { readonly kind: 'cancelled' } | { readonly kind: 'unsupported' };
/** 원본 파일이 있으면 그것, 없으면 화면에 쓰는 data URL 로 만든다 */
export type SaveSource = { readonly file: File | null; readonly dataUrl: string };

export const savePhotos = async (sources: readonly SaveSource[]): Promise<SaveResult> => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const files = await Promise.all(sources.filter((s) => s.file || s.dataUrl).map(async (s, i) => s.file ?? dataUrlToFile(s.dataUrl, `menulens-${stamp}-${i + 1}.jpg`)));
  if (files.length === 0) return { kind: 'unsupported' };
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files }))) {
    try {
      await nav.share({ files, title: 'MenuLens' });
      return { kind: 'shared', count: files.length };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return { kind: 'cancelled' };
      // 공유 실패 시 새 탭 방식으로 폴백
    }
  }
  // 브라우저는 클릭 한 번에 팝업 하나만 허용하므로 첫 장만 연다. 몇 장 중 하나인지 돌려줘 화면이 알린다
  const url = URL.createObjectURL(files[0]!);
  const w = window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return w ? { kind: 'opened', total: files.length } : { kind: 'unsupported' };
};
