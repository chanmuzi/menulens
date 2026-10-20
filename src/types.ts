export type Category = '안주' | '식사' | '음료' | '디저트' | '기타';

export type Point = readonly [number, number];
/** 메뉴판 네 모서리 (왼쪽위, 오른쪽위, 오른쪽아래, 왼쪽아래), 0~1000 정규화 */
export type Quad = readonly [Point, Point, Point, Point];

export type Box = readonly [number, number, number, number];

/** OCR 이 읽은 단어 하나 (0~1000 정규화 bbox) */
export type OcrWord = { readonly id: number; readonly t: string; readonly box: Box };

export type ScanKind = 'menu' | 'sign' | 'other';

export type MenuItem = {
  readonly id: string;
  readonly name_ja: string;
  readonly name_ko: string;
  readonly price_jpy: number | null;
  readonly category: Category;
  readonly icon: string;
  /** OCR 단어 상자의 합집합(정확) 또는 모델 추정(폴백). 없으면 null */
  readonly bbox: Box | null;
  /** 2단계에서 채워지는 상세. 도착 전에는 빈 문자열/빈 배열 */
  readonly pron_ko: string;
  readonly desc_ko: string;
  readonly tags: readonly string[];
  readonly photo_query: string;
  readonly detailed: boolean;
};

/** 메뉴 항목이 아닌 문구 (제목, 안내문) */
export type Note = { readonly text_ja: string; readonly text_ko: string; readonly bbox: Box | null };

export type ScanStatus = 'preparing' | 'reading' | 'streaming' | 'detailing' | 'done' | 'error';

export type Scan = {
  readonly id: string;
  readonly createdAt: number;
  readonly imageDataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly kind: ScanKind;
  readonly shopName: string | null;
  readonly sheetQuad: Quad | null;
  readonly words: readonly OcrWord[];
  /** 사진 속 글자가 시계 방향으로 돌아간 각도. 화면에서 되돌려 세운다 */
  readonly rotation: 0 | 90 | 180 | 270;
  /** 미세 기울기(도). OCR 글줄 각도의 중앙값 */
  readonly tilt: number;
  readonly notes: readonly Note[];
  readonly items: readonly MenuItem[];
  readonly status: ScanStatus;
  readonly error: string | null;
  /** 측정값: OCR 소요 ms, 첫 항목까지 ms, 목록 완성까지 ms, 상세까지 ms */
  readonly timing: { readonly ocrMs: number | null; readonly firstItemMs: number | null; readonly listMs: number | null; readonly totalMs: number | null };
};

export type Rate = { readonly krwPerJpy: number; readonly date: string | null };

export type Photo = { readonly url: string | null; readonly pageUrl?: string | null; readonly credit?: string };

export type ImageMode = 'art' | 'photo';
