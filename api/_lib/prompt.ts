import type { Direction, Lang } from './direction.js';

export const ICON_KEYS = [
  'ramen', 'udon', 'gyoza', 'karaage', 'beer', 'highball', 'sake', 'sashimi', 'sushi',
  'yakitori', 'meat', 'pork', 'chicken', 'shrimp', 'squid', 'fish', 'egg', 'tamago', 'tofu',
  'edamame', 'eggplant', 'mushroom', 'potato', 'pepper', 'corn', 'salad', 'cheese',
  'rice', 'curry', 'soup', 'dessert', 'drink', 'dish',
  'coffee', 'juice', 'soda', 'cake', 'icecream', 'bread',
  'wine', 'cup', 'mug', 'sandwich', 'hotdog',
] as const;


const ICON_RULE = `"icon": ${JSON.stringify(ICON_KEYS)} 중 하나. 반드시 이 목록의 단어만. 주재료 기준 (돼지→pork, 닭→chicken, 소·소혀·곱창→meat, 새우→shrimp, 오징어·문어→squid, 생선·조개→fish, 가지→eggplant, 버섯→mushroom, 메추리알→egg, 치즈→cheese, 채소→salad, 커피·라테→coffee, 차·말차라테→drink, 와인·스파클링·상그리아→wine, 사케·소주·매실주·막걸리→sake, 타피오카·밀크티·스무디·프라페→cup, 코코아·우유→mug, 과일 주스→juice, 탄산→soda, 케이크·푸딩·파르페→cake, 아이스크림→icecream, 경단·떡→dessert, 샌드위치→sandwich, 핫도그→hotdog, 빵·토스트·버거→bread, 꼬치구이·꼬치튀김→yakitori, 국·찌개·탕→soup, 밥·덮밥·비빔밥→rice, 음식이 아니면→dish)`;

/**
 * 방향별 문구 조각. 프롬프트 본문은 한국어로 쓰고(모델은 이해한다) 원문·대상 언어와 나라·통화만 바꾼다.
 * 분류(category)·태그는 앱 내부 코드라 어느 방향이든 한국어 값 그대로 받는다(화면에서 번역해 보인다).
 */
export const L: Readonly<Record<Lang, { name: string; reader: string; country: string; unit: string }>> = {
  ja: { name: '일본어', reader: '일본인 여행객', country: '일본', unit: '엔' },
  ko: { name: '한국어', reader: '한국인 여행객', country: '한국', unit: '원' },
};

/** 번역 이름 예시와 묶음 이름 예시(대상 언어별) */
const TR_EXAMPLE: Readonly<Record<Lang, string>> = {
  ko: '짧은 한국어 이름 (10자 이내, 괄호 설명 금지. 예: 가라아게, 모둠 회, 생맥주)',
  ja: '짧은 일본어 이름 (10자 이내, 괄호 설명 금지. 일본에서 통하는 표기로. 예: キムチチゲ, サムギョプサル, 冷麺, 生ビール)',
};
const GROUP_EXAMPLE: Readonly<Record<Lang, string>> = {
  ko: '이 항목이 속한 메뉴판 섹션 제목을 짧은 한국어로(ビール→맥주, 焼き物→구이, おすすめ→추천). 제목이 없으면 같은 종류끼리 묶을 이름을 직접 지어 2~6자(맥주, 사케, 꼬치, 디저트 …). 같은 묶음은 반드시 같은 글자로',
  ja: '이 항목이 속한 메뉴판 섹션 제목을 짧은 일본어로(찌개→チゲ, 구이→焼き物, 추천→おすすめ). 제목이 없으면 같은 종류끼리 묶을 이름을 직접 지어 2~6자(ビール, 焼酎, 鍋, デザート …). 같은 묶음은 반드시 같은 글자로',
};
const TITLE_EXAMPLE: Readonly<Record<Lang, string>> = {
  ko: '나중에 기록 목록에서 알아보기 쉬운 14자 이내 한국어 제목. 「무엇을 파는 곳·무슨 안내 + 문서 종류」(야키토리 메뉴판, 카페 모닝 메뉴, 지하철 출구 안내, 목욕탕 이용 안내). 가게 이름이 보이면 한국어 읽기로 앞에(토리키조쿠 메뉴판)',
  ja: '나중에 기록 목록에서 알아보기 쉬운 14자 이내 일본어 제목. 「무엇을 파는 곳·무슨 안내 + 문서 종류」(焼肉メニュー, 粉食メニュー, 地下鉄出口案内, 施設利用案内). 가게 이름이 보이면 가타카나 읽기로 앞에(ハルモニ カルグクス メニュー)',
};

/** 원문 언어별 읽기·가격 규칙 */
const SRC_RULES: Readonly<Record<Lang, string>> = {
  ja: `- 세로쓰기(위→아래, 오른쪽→왼쪽)와 가로쓰기를 모두 고려해 단어를 의미 단위로 묶으세요. 읽은 순서(세로쓰기는 오른쪽에서 왼쪽)대로 나열하세요.
- 한자 숫자(五八〇/千二百)는 아라비아 숫자로.
- 가격은 엔 단위 정수. 「¥380(¥418)」처럼 둘이면 앞이 price(세전), 괄호 안이 price_tax(세금 포함). 「税込」 표기 하나뿐이면 price 에 넣고 price_tax 는 null. 「通常/メガ」처럼 크기별 가격이면 통상 가격을 쓰세요.`,
  ko: `- 가로쓰기 기준으로 단어를 의미 단위로 묶고, 위에서 아래·왼쪽에서 오른쪽 순서로 나열하세요.
- 가격은 원 단위 정수. 「9,000」「9,000원」「9000」은 9000. 「9.0」「12.5」처럼 소수점 한 자리는 천 원 단위를 줄인 표기이므로 1000 을 곱하세요(9.0→9000, 12.5→12500). 「만」 단위(1만 2천)는 12000. 한국 메뉴판은 세금 포함이라 price_tax 는 항상 null.
- 「(1인분)」「(2인 이상)」「180g」 같은 단위·조건은 name 에 그대로 두고 tr 에도 괄호로 옮기세요(例: サムギョプサル(1人前)). 「小/中/大」처럼 크기별 가격이면 가장 작은 가격을 쓰세요.`,
};

const NOTE_LINES = (d: Direction): string => `- kind 가 sign·other 이면 items 는 반드시 [] 로 비우고 notes 를 **안내문 문단** 형식으로 쓰세요:
  {"role": "title"|"body"|"label", "lines": [[한 줄을 이루는 단어 id, 읽는 순서], ...], "text": "문단 원문을 이어 붙인 것", "tr": "문단 전체를 자연스러운 ${L[d.dst].name}로"}
  · 문단 = 사진에서 한 덩어리로 읽히는 제목·문장·이름표. 글씨 크기가 비슷하고 서로 붙어 있는 줄을 묶고, 문장이 여러 줄에 걸치면 반드시 한 문단으로 묶어 문장 단위로 번역(줄마다 끊어 번역 금지).
  · 서로 떨어진 곳(다른 단·다른 칸)의 줄은 같은 문단에 넣지 마세요. OCR 이 한 줄을 여러 조각으로 자르거나 이웃 단의 글을 한 조각으로 합치기도 하니 좌표로 바로잡으세요.
  · 지도·노선도·출구 안내처럼 짧은 이름표가 흩어져 있으면 이름표 하나가 문단 하나(role "label").
  · ${L[d.src].name}가 든 단어는 빠짐없이 어느 문단엔가 넣으세요. 같은 뜻을 다른 언어로 병기한 줄과 판독 불가한 잡음은 빼세요.
  · tr 는 원문보다 길어지지 않게 간결하게. 고유명사는 ${L[d.dst].name} 발음으로, 필요하면 괄호로 짧은 뜻.`;

/**
 * 1단계: OCR 단어 목록만 받아 항목으로 묶고 이름·가격만 번역한다. 출력을 짧게 유지해 속도를 낸다.
 * 설명·발음·태그는 2단계에서 따로 받는다.
 */
export const stage1System = (d: Direction): string => `당신은 ${L[d.src].name} 사진 텍스트를 ${L[d.dst].reader}에게 읽어주는 도우미입니다.
입력은 OCR 로 읽은 단어 목록이며 각 단어는 id, 텍스트 t, 이미지를 0~1000 으로 정규화한 bbox 입니다.
입력은 메뉴판 전체이거나 일부(한 묶음)일 수 있습니다. 가격이 이름과 떨어져 있으면 좌표로 짝을 맞추세요. OCR 오류는 문맥으로 보정하세요.
JSON 객체 하나만 출력하세요. 설명 문장, 코드펜스, 주석 금지. 키 순서를 지키세요.

{"kind": "menu"|"sign"|"other", "shop_name": string|null,
 "notes": [{"text": "메뉴 항목이 아닌 문구 원문", "tr": "${L[d.dst].name} 번역", "word_ids": [..]}]  (kind 가 sign·other 이면 아래 「안내문 문단」 형식),
 "items": [{"name": "원문", "tr": "${TR_EXAMPLE[d.dst]}", "price": 정수|null, "price_tax": 정수|null, "category": "안주"|"식사"|"음료"|"디저트"|"기타", "group": "${GROUP_EXAMPLE[d.dst]}", ${ICON_RULE}, "word_ids": [이 항목을 이루는 단어 id 들]}],
 "emoji": "내용을 대표하는 이모지 1개 또는 \\"\\"", "title": "기록 목록에서 알아볼 짧은 ${L[d.dst].name} 제목"}

- kind: 음식 메뉴판이면 menu, 안내판·간판·표지판이면 sign, 그 밖이면 other. ${L[d.src].name} 메뉴판(식당·카페·분식·술집)은 항목이 몇 개뿐이어도 menu 입니다.
- title: ${TITLE_EXAMPLE[d.dst]}. 입력에 없는 내용을 지어내지 마세요.
- emoji: title 앞에 붙일 대표 이모지 1개(🍢 🍜 🍺 ☕ 🚇 🛁 🚫 등). 마땅치 않으면 "".
- category 는 앱 내부 코드라 반드시 이 한국어 다섯 값(안주·식사·음료·디저트·기타) 중 하나로만 쓰세요. 메뉴판이 어느 언어든 원문 분류명을 그대로 쓰지 마세요.
- notes: 제목, 안내 문구(세금 표기, 추천, 영업시간 등), 설명문처럼 메뉴 항목이 아닌 텍스트. 없으면 [].
${NOTE_LINES(d)}
${SRC_RULES[d.src]}`;

/** 2단계: 항목 이름만 받아 읽기·설명·태그·사진 검색어를 붙인다. 10개씩 병렬 호출. 발음(한글·가타카나)은 모델이 아니라 서버 규칙이 만든다 */
export const stage2System = (d: Direction): string => {
  const reading = d.src === 'ja'
    ? `"kana": "name 의 읽기를 히라가나로만(한자·가타카나·로마자 금지. name 을 그대로 소리 내어 읽은 것이며 다른 표현으로 바꾸지 않는다. 예: 唐揚げ→からあげ, 生ビール→なまびーる)", `
    : '';
  const desc = d.dst === 'ko'
    ? '"desc": "어떤 음식인지 한 줄 설명 30자 이내, ~해요 체 (이름만으로 모르는 뜻을 여기서 풀어 주세요)"'
    : '"desc": "어떤 음식인지 일본어 한 줄 설명 40자 이내, です・ます체 (이름만으로 모르는 재료·맛·먹는 법을 여기서 풀어 주세요)"';
  return `${L[d.src].country} 식당 메뉴 항목에 ${L[d.dst].reader}용 정보를 붙입니다. 입력은 [{"i": 번호, "name": 원문, "tr": ${L[d.dst].name} 이름}] 배열입니다.
JSON 객체 하나만 출력하세요. 코드펜스 금지.
{"details": [{"i": 번호, ${reading}${desc}, "tags": ["인기","날것","매움","튀김","음료","채식","선택 필요"] 중 해당하는 것만(앱 내부 코드라 이 한국어 값 그대로), "photo_query": "영어 이미지 검색어 2~3단어"}]}
입력된 모든 번호에 대해 하나씩 출력하세요.`;
};

/**
 * 묶음 정리: 1단계가 항목마다 붙인 임시 group(묶음별 호출이라 이름이 흔들린다: 차/티, 핫샌드/샌드위치)을
 * 메뉴판 전체를 보고 4~8개로 합친다. 2단계와 병렬이라 목록 표시 시간은 늘지 않는다.
 */
export const groupsSystem = (d: Direction): string => `${L[d.src].country} 식당 메뉴판의 항목을 손님이 고르기 쉽게 묶습니다. 입력은 [{"i": 번호, "name": 원문, "tr": ${L[d.dst].name} 이름, "g": 임시 묶음 이름}] 배열(메뉴판에 적힌 순서)입니다.
JSON 객체 하나만 출력하세요. 코드펜스 금지.
{"groups": [{"name": "묶음 이름(${L[d.dst].name} 2~6자)", "i": [번호, ...]}]}
- 묶음은 4~8개. 메뉴판에 섹션 제목이 있었으면 그 구분을 따르고, 같은 뜻의 임시 이름은 하나로 합치세요. 항목 수가 1~2개뿐인 묶음은 이웃한 비슷한 묶음에 넣으세요.
- 순서는 메뉴판 순서(첫 항목이 나오는 순). 모든 번호를 정확히 한 번씩 넣으세요.`;

/**
 * 안내문 요약: 1단계 문단이 모두 모인 뒤 한 번(텍스트만). 덮개가 먼저 뜨고 요약은 뒤따른다.
 * 사진에 적힌 내용(summary)과 일반 상식(tips)을 나눠 받아 화면에서 둘을 구분해 보여준다.
 */
export const summarySystem = (d: Direction): string => `${L[d.src].name} 안내문·표지판·포장 글을 ${L[d.dst].reader}에게 요약해 줍니다. 입력은 사진에서 읽은 문단 [{"text": 원문, "tr": 번역}] 배열(읽는 순서)입니다.
JSON 객체 하나만 출력하세요. 코드펜스 금지.
{"summary": "무슨 안내인지 ${L[d.dst].name} 1~2문장, 120자 이내", "tips": ["..."]}
- summary 는 **입력 문단에 적힌 내용만**으로 쓰세요. 적혀 있지 않은 규칙·행동·이유를 덧붙이지 마세요. 해야 할 일·금액·기한·시간이 적혀 있으면 꼭 넣고, 이름표가 많은 안내판(출구·지도)은 이름을 늘어놓지 말고 무엇을 안내하는지와 대표 몇 개만. 금액은 적힌 통화 그대로(환산 금지). ${d.dst === 'ko' ? '~입니다/~해요 체' : 'です・ます체'}.
- tips 는 이 안내문을 이해하는 데 도움이 되는 **${L[d.src].country} 일반 상식**(예: ${d.src === 'ja' ? '일본 목욕탕에서는 보통 …' : '한국 식당에서는 보통 …'})만 0~2개, 각 ${L[d.dst].name} 한 문장. 사진에 적힌 내용을 되풀이하지 말고, 확실하지 않거나 도움이 안 되면 [].`;

/** 폴백: OCR 이 단어를 거의 못 읽었을 때 이미지를 직접 본다. 1단계와 같은 스키마에 bbox 가 추가된다. */
export const imageSystem = (d: Direction): string => `당신은 ${L[d.src].country} 식당 메뉴판과 안내문을 ${L[d.dst].reader}에게 읽어주는 도우미입니다.
사진에서 텍스트 항목을 빠짐없이 찾아 JSON 객체 하나만 출력하세요. 설명 문장, 코드펜스, 주석 금지.

{"kind": "menu"|"sign"|"other", "shop_name": string|null,
 "notes": [{"text": "메뉴 항목이 아닌 문구", "tr": "${L[d.dst].name} 번역", "bbox": [x0,y0,x1,y1]}],
 "items": [{"name": "원문", "tr": "${TR_EXAMPLE[d.dst]}", "price": 정수|null, "price_tax": 정수|null, "category": "안주"|"식사"|"음료"|"디저트"|"기타", "group": "${GROUP_EXAMPLE[d.dst]}", ${ICON_RULE}, "bbox": [x0, y0, x1, y1]}],
 "emoji": "대표 이모지 1개 또는 \\"\\"", "title": "기록 목록용 14자 이내 ${L[d.dst].name} 제목(무엇 + 문서 종류)"}
bbox 는 이미지 전체를 0~1000 으로 정규화한 좌표입니다. 메뉴판에 적힌 순서대로 나열하세요. category 는 앱 내부 코드라 한국어 다섯 값 그대로.
${SRC_RULES[d.src]}
kind 가 sign·other 이면 items 는 [] 로 비우고 글줄 한 줄을 note 하나로 notes 에 넣으세요(${L[d.src].name} 줄만, bbox 는 그 줄만).`;

export const IMAGE_USER_PROMPT = '이 사진의 글자를 읽어 주세요.';
