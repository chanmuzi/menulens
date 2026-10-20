/** Upstage Document OCR: 이미지 → 단어 목록(텍스트 + 0~1000 정규화 bbox) + 글자 방향. 약 3초. */

export type OcrWord = { readonly id: number; readonly t: string; readonly box: readonly [number, number, number, number] };
export type OcrResult = {
  readonly width: number;
  readonly height: number;
  readonly words: readonly OcrWord[];
  /** 사진 속 글자가 시계 방향으로 돌아간 각도 (0 | 90 | 180 | 270). 화면에서 -rotation 만큼 돌리면 바로 선다. */
  readonly rotation: 0 | 90 | 180 | 270;
  /** rotation 을 뺀 나머지 미세 기울기 (도, -45~45). 화면에서 이것도 되돌리면 글줄이 수평이 된다. */
  readonly tilt: number;
  readonly ms: number;
};

const ENDPOINT = 'https://api.upstage.ai/v1/document-digitization';

type Vertex = { x: number; y: number };
type RawWord = { id: number; text: string; confidence: number; boundingBox: { vertices: Vertex[] } };
type RawPage = { width: number; height: number; words: RawWord[] };

const base64ToBytes = (b64: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/**
 * 글자 방향 추정. OCR 의 vertices 는 글자 기준 왼쪽위부터 시계 방향이므로
 * vertices[0]→[1] 벡터가 글줄의 진행 방향이다. 단어별 각도의 중앙값을 90° 단위로 반올림한다.
 * 세로쓰기 일본어는 글자 하나하나가 똑바로 서 있어 0° 로 잡힌다.
 */
const estimateAngle = (words: readonly RawWord[]): { rotation: 0 | 90 | 180 | 270; tilt: number } => {
  const angles = words
    .filter((w) => w.text.length >= 2 && w.boundingBox.vertices.length >= 2)
    .map((w) => {
      const [a, b] = w.boundingBox.vertices;
      return (Math.atan2(b!.y - a!.y, b!.x - a!.x) * 180) / Math.PI;
    })
    .sort((x, y) => x - y);
  if (angles.length === 0) return { rotation: 0, tilt: 0 };
  const median = angles[Math.floor(angles.length / 2)]!;
  const snappedRaw = Math.round(median / 90) * 90;
  const rotation = (((snappedRaw % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  return { rotation, tilt: Math.round((median - snappedRaw) * 10) / 10 };
};

export const runOcr = async (base64: string, mediaType: string, key: string): Promise<OcrResult> => {
  const t0 = Date.now();
  const form = new FormData();
  form.append('document', new Blob([base64ToBytes(base64)], { type: mediaType }), 'menu.jpg');
  form.append('model', 'ocr');
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`ocr ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const data = (await res.json()) as { pages?: RawPage[] };
  const page = data.pages?.[0];
  if (!page) return { width: 1, height: 1, words: [], rotation: 0, tilt: 0, ms: Date.now() - t0 };
  const norm = (v: number, max: number): number => Math.max(0, Math.min(1000, Math.round((v / max) * 1000)));
  const raw = page.words.filter((w) => w.text.trim().length > 0);
  const words = raw.map((w) => {
    const xs = w.boundingBox.vertices.map((v) => v.x);
    const ys = w.boundingBox.vertices.map((v) => v.y);
    return { id: w.id, t: w.text, box: [norm(Math.min(...xs), page.width), norm(Math.min(...ys), page.height), norm(Math.max(...xs), page.width), norm(Math.max(...ys), page.height)] as const };
  });
  return { width: page.width, height: page.height, words, ...estimateAngle(raw), ms: Date.now() - t0 };
};
