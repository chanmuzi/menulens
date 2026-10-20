export const ICON_KEYS = [
  'ramen', 'udon', 'gyoza', 'karaage', 'beer', 'highball', 'sake', 'sashimi', 'sushi',
  'yakitori', 'meat', 'pork', 'chicken', 'shrimp', 'squid', 'fish', 'egg', 'tamago', 'tofu',
  'edamame', 'eggplant', 'mushroom', 'potato', 'pepper', 'corn', 'salad', 'cheese',
  'rice', 'curry', 'soup', 'dessert', 'drink', 'dish',
] as const;

/** 텍스트 전용 2단계와 이미지 폴백 모두 Sonnet. 벤치마크: docs/benchmarks.md */
export const MODEL = 'claude-sonnet-5-5';

const ITEM_SCHEMA = `Item = {
  "name_ja": 원문 그대로 (OCR 오류는 문맥으로 보정),
  "name_ko": 짧은 한국어 이름. 외래어 표기 뒤에 필요하면 괄호로 뜻 (예: "가라아게 (닭튀김)", "모둠 회"),
  "pron_ko": 일본어 발음을 한글로 (예: "카라아게"),
  "price_jpy": 정수 또는 null (한자 숫자 五八〇/千二百 는 아라비아 숫자로. 세로쓰기는 위→아래 순서),
  "desc_ko": 여행객용 한 줄 설명, 30자 이내, "~해요" 체,
  "tags": ["인기","날것","매움","튀김","음료","채식","선택 필요"] 중 해당하는 것만,
  "category": "안주" | "식사" | "음료" | "디저트" | "기타",
  "icon": ${JSON.stringify(ICON_KEYS)} 중 하나. 반드시 이 목록의 단어만. 조리 형태보다 주재료 기준 (돼지→pork, 닭→chicken, 소·소혀·곱창→meat, 새우→shrimp, 오징어·문어→squid, 생선·조개→fish, 가지→eggplant, 버섯→mushroom, 메추리알→egg, 치즈→cheese, 채소 전반→salad, 음식이 아니면→dish). 같은 메뉴판 안에서 가능한 한 서로 다르게,
  "photo_query": 영어 이미지 검색어 2~3단어`;

/** 2단계: OCR 단어 목록(텍스트+좌표)만 받아 구조화·번역. 이미지는 보지 않는다. */
export const TEXT_SYSTEM_PROMPT = `당신은 일본어 사진 텍스트를 한국인 여행객에게 읽어주는 도우미입니다.
입력은 OCR 로 읽은 단어 목록이며 각 단어는 id, 텍스트 t, 이미지를 0~1000 으로 정규화한 bbox 입니다.
세로쓰기(위→아래, 오른쪽→왼쪽)와 가로쓰기를 모두 고려해 단어를 의미 단위로 묶으세요. 가격이 이름과 떨어져 있으면 좌표로 짝을 맞추세요.
JSON 객체 하나만 출력하세요. 설명 문장, 코드펜스, 주석 금지.

{"kind": "menu" | "sign" | "other", "shop_name": string|null, "items": [Item, ...]}
- kind: 음식 메뉴판이면 menu, 안내판·간판·표지판이면 sign, 그 밖이면 other.
- menu 가 아니면 의미 있는 문장·문구 하나가 Item 하나입니다. name_ko 에 번역, desc_ko 에 보충 설명, price_jpy 는 null, category 는 "기타", icon 은 "dish".
${ITEM_SCHEMA},
  "word_ids": [이 항목을 이루는 단어 id 들]
}
읽은 순서(세로쓰기는 오른쪽에서 왼쪽)대로 나열하세요.`;

/** 폴백: OCR 이 단어를 거의 못 읽었을 때 이미지를 직접 본다. */
export const IMAGE_SYSTEM_PROMPT = `당신은 일본 식당 메뉴판과 안내문을 한국인 여행객에게 읽어주는 도우미입니다.
사진에서 텍스트 항목을 빠짐없이 찾아 JSON 객체 하나만 출력하세요. 설명 문장, 코드펜스, 주석 금지.

{"kind": "menu" | "sign" | "other", "shop_name": string|null, "items": [Item, ...]}
${ITEM_SCHEMA},
  "bbox": [x0, y0, x1, y1] (이미지 전체를 0~1000 으로 정규화, 이 항목의 텍스트 영역)
}
메뉴판에 적힌 순서(세로쓰기는 오른쪽에서 왼쪽)대로 나열하세요.`;

export const IMAGE_USER_PROMPT = '이 사진의 글자를 읽어 주세요.';
