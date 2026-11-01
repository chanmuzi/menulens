export type Category = '안주' | '식사' | '음료' | '디저트' | '기타';
/** 2단계 태그(모델이 내는 한국어 값, api/_lib/prompt.ts STAGE2_SYSTEM 과 같아야 한다) */
export type Tag = '인기' | '날것' | '매움' | '튀김' | '음료' | '채식' | '선택 필요';

export type Point = readonly [number, number];
/** 메뉴판 네 모서리 (왼쪽위, 오른쪽위, 오른쪽아래, 왼쪽아래), 0~1000 정규화 */
export type Quad = readonly [Point, Point, Point, Point];

export type Box = readonly [number, number, number, number];

/** OCR 이 읽은 단어 하나 (0~1000 정규화 bbox) */
export type OcrWord = { readonly id: number; readonly t: string; readonly box: Box };

export type ScanKind = 'menu' | 'sign' | 'other';

/** 사진 원문 언어(src)와 번역 대상 언어(dst). 2026-10-31 이전 기록에는 없고 일→한으로 본다 */
export type ScanLang = { readonly src: 'ja' | 'ko'; readonly dst: 'ko' | 'ja' };
export type Currency = 'JPY' | 'KRW';

export type MenuItem = {
  readonly id: string;
  /** 사진에 적힌 원문 이름 */
  readonly name: string;
  /** 번역한 짧은 이름(앱 언어) */
  readonly tr: string;
  /** 가격(통화는 Scan.currency). 없으면 null */
  readonly price: number | null;
  /** 괄호 안 세금 포함 가격 (¥380(¥418) 의 418). 없으면 null. 실제 지불액은 payableJpy() */
  readonly price_tax: number | null;
  readonly category: Category;
  /** 메뉴판 섹션(모델이 원문 제목을 옮기거나 즉석에서 지은 짧은 한국어). 없으면 null → 카드 뷰는 category 로 묶는다 */
  readonly group: string | null;
  readonly icon: string;
  /** OCR 단어 상자의 합집합(정확) 또는 모델 추정(폴백). 없으면 null */
  readonly bbox: Box | null;
  /** 2단계에서 채워지는 상세. 도착 전에는 빈 문자열/빈 배열. pron 은 원문의 발음을 앱 언어 글자로 적은 것 */
  readonly pron: string;
  readonly desc: string;
  readonly tags: readonly string[];
  readonly photo_query: string;
  readonly detailed: boolean;
};

/** 서버가 메뉴판 전체를 보고 정리한 묶음: 이름과 그 묶음에 든 항목 id(key) */
export type ScanGroup = { readonly name: string; readonly keys: readonly string[] };

/** 안내문 문단의 쓰임: 제목·본문·짧은 이름표(지도·출구 안내) */
export type NoteRole = 'title' | 'body' | 'label';

/**
 * 메뉴 항목이 아닌 문구 (제목, 안내문). 안내문은 문단 하나가 Note 하나다.
 * lines 는 문단을 이루는 줄 상자(원문을 줄마다 지운다). 2026-10-23 이전 기록·메뉴판 문구·이미지 폴백에는 없고 bbox 하나뿐이다.
 */
/** text 는 원문, tr 은 번역(앱 언어) */
export type Note = { readonly text: string; readonly tr: string; readonly bbox: Box | null; readonly lines?: readonly Box[]; readonly role?: NoteRole };

/** 안내문 요약: 사진에 적힌 내용(text)과 사진에 없는 일반 상식(tips)을 나눠 둔다 */
export type NoticeSummary = { readonly text: string; readonly tips: readonly string[] };

export type ScanStatus = 'preparing' | 'reading' | 'streaming' | 'detailing' | 'done' | 'error';

export type Scan = {
  readonly id: string;
  /** 여러 장을 한 번에 읽었을 때 묶음 id. 한 장이면 null. 결과 화면 상단 띠로 같은 묶음끼리 오간다 */
  readonly batchId: string | null;
  readonly createdAt: number;
  readonly imageDataUrl: string;
  readonly width: number;
  readonly height: number;
  readonly kind: ScanKind;
  /** 종류가 판정됐는지. 처리 중 화면은 판정 전까지 메뉴판·안내문 어느 쪽도 전제하지 않는 문구를 쓴다 */
  readonly kindKnown: boolean;
  /** 원문·번역 언어와 가격 통화. 지금은 일→한·JPY 고정, 역방향 PR 에서 서버가 채운다 */
  readonly lang: ScanLang;
  readonly currency: Currency;
  readonly shopName: string | null;
  /** 기록 목록용 자동 제목(「🍢 야키토리 메뉴판」, 1단계 응답에 함께 온다). 2026-10-23 이전 기록에는 없다 → history.ts 가 옛 규칙으로 짓는다 */
  readonly autoTitle?: string | null;
  /** 사용자가 고친 이름. 고친 적 없으면 없음/null */
  readonly userTitle?: string | null;
  /** 목록 썸네일(정사각 JPEG data URL, 10KB 안팎). 없으면 목록이 저장된 사진에서 만들어 채운다 */
  readonly thumb?: string | null;
  readonly sheetQuad: Quad | null;
  readonly words: readonly OcrWord[];
  /** 사진 속 글자가 시계 방향으로 돌아간 각도. 화면에서 되돌려 세운다 */
  readonly rotation: 0 | 90 | 180 | 270;
  /** 미세 기울기(도). OCR 글줄 각도의 중앙값 */
  readonly tilt: number;
  readonly notes: readonly Note[];
  /** 안내문·기타의 요약. 메뉴판·요약 전·이전 기록이면 null */
  readonly summary: NoticeSummary | null;
  /** 정리된 묶음. 오기 전·실패·소수 항목이면 null → 항목의 group/category 로 묶는다 */
  readonly groups: readonly ScanGroup[] | null;
  readonly items: readonly MenuItem[];
  readonly status: ScanStatus;
  readonly error: string | null;
  /** 측정값: OCR 소요 ms, 첫 항목까지 ms, 목록 완성까지 ms, 상세까지 ms */
  readonly timing: { readonly ocrMs: number | null; readonly firstItemMs: number | null; readonly listMs: number | null; readonly totalMs: number | null };
};

export type Rate = { readonly krwPerJpy: number; readonly date: string | null };

export type Photo = { readonly url: string | null; readonly pageUrl?: string | null; readonly credit?: string };

export type ImageMode = 'art' | 'photo';

/** 사진이 들어온 경로. 촬영만 확인 화면을 건너뛴다 */
export type PickSource = 'camera' | 'album' | 'paste' | 'drop';

/** 대화 통역: 누가 한 말인지. me = 나(대화의 내 언어 → 상대 언어), them = 상대 */
export type TalkWho = 'me' | 'them';
/** 대화의 언어: 나(대화를 만들 때의 앱 언어)와 상대. 옛 기록은 읽을 때 한→일로 채운다 */
export type TalkLang = { readonly me: 'ko' | 'ja'; readonly them: 'ko' | 'ja' };

/** 대화 한 마디. 번역은 필드가 도착하는 대로 채워진다(status 'translating' 동안 비어 있을 수 있다) */
export type TalkTurn = {
  readonly id: string;
  readonly who: TalkWho;
  /** voice = 말하기, text = 글로 쓰기, helper = 도우미가 추천한 문장 */
  readonly via: 'voice' | 'text' | 'helper';
  /** 받아 적은 말·입력한 글 그대로 */
  readonly src: string;
  /** 음성 인식 오류·오타를 고친 원문(없으면 src 를 쓴다) */
  readonly fixed: string;
  readonly ja: string;
  readonly ko: string;
  /** 상대 언어 번역문을 내 글자로 읽는 발음(내 말만, 서버 규칙: 일본어는 kana → 한글, 한국어는 가타카나) */
  readonly pron: string;
  /** ja 전체 히라가나(상대 언어가 일본어일 때 내 말만, 크게 보기에서) */
  readonly kana: string;
  readonly en: string;
  readonly status: 'translating' | 'done' | 'error';
  readonly at: number;
};

/** 도우미(상대에게 안 보이는 질문) 대화 한 줄 */
export type HelperMsg = { readonly role: 'me' | 'bot'; readonly text: string; readonly at: number };

/** 대화 기록 하나. 새 대화를 시작하면 생기고, 첫 마디가 끝나야 저장된다 */
export type Talk = {
  readonly id: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** 대화 내용을 보고 지은 「이모지 + 제목」. 아직 없으면 null */
  readonly autoTitle: string | null;
  /** 자동 제목을 지을 때의 마디 수(내용이 늘면 한 번 더 짓는다) */
  readonly titledAt: number;
  readonly userTitle: string | null;
  readonly turns: readonly TalkTurn[];
  readonly helper: readonly HelperMsg[];
  readonly lang: TalkLang;
};

/** 말풍선에 보일 두 언어. 기본은 한·日 */
export type TalkPair = 'ko-ja' | 'ko-en' | 'ja-en';
