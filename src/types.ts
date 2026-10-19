export type Category = '안주' | '식사' | '음료' | '디저트';

export type Point = readonly [number, number];
/** 메뉴판 네 모서리 (왼쪽위, 오른쪽위, 오른쪽아래, 왼쪽아래), 0~1000 정규화 */
export type Quad = readonly [Point, Point, Point, Point];

export type MenuItem = {
  readonly id: string;
  readonly name_ja: string;
  readonly name_ko: string;
  readonly pron_ko: string;
  readonly price_jpy: number | null;
  readonly desc_ko: string;
  readonly tags: readonly string[];
  readonly category: Category;
  readonly icon: string;
  readonly photo_query: string;
  readonly bbox: readonly [number, number, number, number];
};

export type ScanStatus = 'preparing' | 'streaming' | 'done' | 'error';

export type Scan = {
  readonly id: string;
  readonly createdAt: number;
  readonly imageDataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly shopName: string | null;
  readonly sheetQuad: Quad | null;
  readonly items: readonly MenuItem[];
  readonly status: ScanStatus;
  readonly error: string | null;
};

export type Rate = { readonly krwPerJpy: number; readonly date: string | null };

export type Photo = { readonly url: string | null; readonly pageUrl?: string | null; readonly credit?: string };

export type ImageMode = 'art' | 'photo';
