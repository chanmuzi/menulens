/**
 * 클립보드의 이미지를 File 로 꺼낸다. 두 경로가 있다.
 * - paste 이벤트(Ctrl/Cmd+V): 데스크톱에서 권한 없이 동작. clipboardData 의 files/items 를 본다.
 * - navigator.clipboard.read(): 모바일용 "붙여넣기" 버튼. 사용자 탭 안에서 호출해야 하며 iOS 는 1회 허용 말풍선을 띄운다.
 */

export type ClipboardResult =
  | { readonly ok: true; readonly file: File }
  | { readonly ok: false; readonly reason: 'empty' | 'denied' | 'unsupported' };

const isImage = (f: File | Blob): boolean => f.type.startsWith('image/');

const toFile = (blob: Blob, name: string): File => (blob instanceof File ? blob : new File([blob], name, { type: blob.type }));

/** navigator.clipboard.read() 를 쓸 수 있는 브라우저인지 (HTTPS + API 존재) */
export const canReadClipboard = (): boolean =>
  typeof navigator !== 'undefined' && !!navigator.clipboard && typeof navigator.clipboard.read === 'function';

/** paste 이벤트에서 첫 이미지 파일을 꺼낸다. 없으면 null */
export const imageFromPasteEvent = (e: ClipboardEvent): File | null => {
  const data = e.clipboardData;
  if (!data) return null;
  const fromFiles = Array.from(data.files).find(isImage);
  if (fromFiles) return fromFiles;
  const item = Array.from(data.items).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
  const blob = item?.getAsFile() ?? null;
  return blob && isImage(blob) ? toFile(blob, 'clipboard.png') : null;
};

/** 버튼 탭에서 호출. 클립보드의 첫 이미지를 File 로 돌려준다 */
export const readImageFromClipboard = async (): Promise<ClipboardResult> => {
  if (!canReadClipboard()) return { ok: false, reason: 'unsupported' };
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (!type) continue;
      const blob = await item.getType(type);
      return { ok: true, file: toFile(blob, `clipboard.${type.split('/')[1] ?? 'png'}`) };
    }
    return { ok: false, reason: 'empty' };
  } catch (e) {
    // NotAllowedError: 사용자가 거부했거나 권한 없음. DataError 등은 이미지가 아닌 경우로 본다
    const name = e instanceof DOMException ? e.name : '';
    return { ok: false, reason: name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'empty' };
  }
};
