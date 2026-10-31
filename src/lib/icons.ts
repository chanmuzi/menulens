import type { Category } from '../types';

export const ICON_KEYS = new Set([
  'ramen', 'udon', 'gyoza', 'karaage', 'beer', 'highball', 'sake', 'sashimi', 'sushi',
  'yakitori', 'meat', 'pork', 'chicken', 'shrimp', 'squid', 'fish', 'egg', 'tamago', 'tofu',
  'edamame', 'eggplant', 'mushroom', 'potato', 'pepper', 'corn', 'salad', 'cheese',
  'rice', 'curry', 'soup', 'dessert', 'drink', 'dish',
  'coffee', 'juice', 'soda', 'cake', 'icecream', 'bread',
  'wine', 'cup', 'mug', 'sandwich', 'hotdog',
]);

/** 음료 아이콘. 음료 칸이거나 모델이 이 중 하나를 골랐으면 음료 규칙으로만 판정한다 (アイス = 차가운, 추가 재료는 무시) */
const DRINK_ICONS = new Set(['beer', 'highball', 'sake', 'wine', 'coffee', 'drink', 'juice', 'soda', 'cup', 'mug']);

type Rule = readonly [RegExp, string];

/**
 * 음료 이름 → 아이콘. 앞 규칙이 이긴다.
 * 원칙: 술 종류 → 차 라테 → 커피 → 타피오카·스무디(컵) → 코코아·우유(머그) → 주스 → 탄산 → 차.
 */
const DRINK_RULES: ReadonlyArray<Rule> = [
  // 한국어 메뉴(역방향). 한글 패턴이라 일본어 이름과 겹치지 않는다
  [/맥주|생맥|하이트|카스|테라|클라우드/, 'beer'],
  [/하이볼|칵테일|위스키|사워/, 'highball'],
  [/와인|샴페인|스파클링/, 'wine'],
  [/소주|막걸리|동동주|청주|복분자|매실주|정종|사케/, 'sake'],
  [/커피|아메리카노|라떼|라테|에스프레소|카푸치노/, 'coffee'],
  [/밀크티|버블티|스무디|프라페|쉐이크|셰이크/, 'cup'],
  [/코코아|핫초코|우유/, 'mug'],
  [/콜라|사이다|탄산|에이드/, 'soda'],
  [/주스|오렌지|자몽|포도|딸기|망고|식혜|수정과/, 'juice'],
  [/빙수|아이스크림/, 'icecream'],
  [/녹차|홍차|유자차|생강차|보리차|차$/, 'drink'],
  [/ビール|生中|生ビ|黒ビール|クラフトビア|ドラフト/, 'beer'],
  [/ハイボール|サワー|チューハイ|酎ハイ|カクテル|ウイスキー|ウィスキー|バーボン|ブランデー|コニャック|ジン(?!ジャー)|ウォッカ|テキーラ/, 'highball'],
  [/ワイン|スパークリング|スプマンテ|シャンパン|シャンパーニュ|サングリア|ロゼ|ブラン|ルージュ|ロッソ|ビアンコ|プロセッコ|カヴァ|\(赤\)|\(白\)|赤[・·]白/, 'wine'],
  [/日本酒|冷酒|熱燗|焼酎|梅酒|マッコリ|泡盛|にごり|水割|お湯割|ソーダ割|ウーロン割|ロック\)|\(ロック|(?<!甘)酒/, 'sake'], // 甘酒 는 술이 아니라 머그
  [/抹茶|ほうじ茶|チャイ/, 'drink'], // 抹茶ラテ 는 커피가 아니라 차
  [/コーヒー|珈琲|エスプレッソ|カフェ|カプチーノ|モカ|アメリカーノ|オレ(?!ンジ)|ブレンド|ラテ/, 'coffee'], // オレンジ 의 オレ 제외
  [/タピオカ|奶茶|ミルクティー|フラッペ|フローズン|フリージー|スムージー|シェイク|フロート/, 'cup'],
  [/ココア|ホットチョコ|チョコラテ|ミルク|牛乳|甘酒|ゆず茶|しょうが湯|生姜湯/, 'mug'],
  [/コーラ|ソーダ|サイダー|ラムネ|ジンジャーエール|炭酸|スプライト|カルピス|ペプシ|トニック/, 'soda'],
  [/ジュース|オレンジ|りんご|リンゴ|林檎|グレープ|蜜柑|みかん|レモネード|マンゴー|バナナ|いちご|イチゴ|苺|メロン|ピーチ|ぶどう|ブドウ|果汁|搾り|トマト/, 'juice'],
  [/アイスクリーム|ソフトクリーム|かき氷/, 'icecream'],
  [/茶|ティー|ウーロン|ジャスミン|ルイボス|ハーブ|お水|ミネラルウォーター|^水$/, 'drink'],
];

/**
 * 음식 이름 → 아이콘. 앞 규칙이 이긴다: 요리명(꼬치·면·샐러드·국) → 주재료 → 채소 → 뭉뚱그린 것.
 */
const FOOD_RULES: ReadonlyArray<Rule> = [
  // 한국어 메뉴(역방향)
  [/라면|라멘|짬뽕|우동|국수|냉면|칼국수|수제비|쫄면|비빔면|막국수/, 'ramen'],
  [/만두/, 'gyoza'],
  [/치킨|닭강정|닭튀김|닭갈비|닭|삼계탕/, 'chicken'],
  [/삼겹|목살|항정|갈매기|돼지|제육|족발|보쌈|돈까스|돈가스|수육/, 'pork'],
  [/한우|소고기|등심|안심|갈비|불고기|육회|곱창|대창|막창/, 'meat'],
  [/새우/, 'shrimp'],
  [/오징어|낙지|문어|쭈꾸미|주꾸미/, 'squid'],
  [/회$|회 |물회|고등어|갈치|조기|광어|연어|장어|생선|조개|전복|굴$|꽃게|해물|해산물|멍게|홍합/, 'fish'],
  [/계란|달걀|메추리/, 'egg'],
  [/두부|순두부/, 'tofu'],
  [/버섯/, 'mushroom'],
  [/감자|고구마|튀김/, 'potato'],
  [/고추|청양/, 'pepper'],
  [/옥수수/, 'corn'],
  [/샐러드|나물|겉절이|무침|김치/, 'salad'],
  [/치즈/, 'cheese'],
  [/볶음밥|비빔밥|덮밥|김밥|주먹밥|공기밥|밥/, 'rice'],
  [/카레/, 'curry'],
  [/찌개|탕|국$|국 |전골|해장|설렁|곰탕|순대국|죽/, 'soup'],
  [/떡|경단|약과|호떡/, 'dessert'],
  [/케이크|푸딩|마카롱|쿠키/, 'cake'],
  [/빵|토스트|버거|크로플|와플/, 'bread'],
  [/샌드위치/, 'sandwich'],
  [/핫도그/, 'hotdog'],
  [/꼬치|산적/, 'yakitori'],
  [/ラーメン|らーめん|拉麺|つけ麺|中華そば/, 'ramen'],
  [/うどん|饂飩|そば|蕎麦|焼きそば|焼そば|パスタ|にゅうめん|素麺|そうめん/, 'udon'],
  [/餃子|ぎょうざ|ギョーザ|焼売|シュウマイ/, 'gyoza'],
  [/唐揚|から揚|からあげ|カラアゲ|竜田/, 'karaage'],
  [/焼鳥|焼き鳥|やきとり|つくね|ねぎま|串カツ|串揚|串焼|串/, 'yakitori'],
  [/刺身|さしみ|造り/, 'sashimi'],
  [/寿司|鮨|すし|握り|巻き/, 'sushi'],
  [/だし巻|出汁巻|玉子焼|卵焼|オムレツ|オムライス/, 'tamago'],
  [/サンド/, 'sandwich'],
  [/ドッグ/, 'hotdog'],
  [/パン|トースト|バーガー|ベーグル|クロワッサン|マフィン/, 'bread'],
  [/サラダ/, 'salad'],
  [/味噌汁|みそ汁|スープ|鍋|おでん|雑炊|お吸い物|豚汁/, 'soup'],
  [/(^|[^ス])カレー/, 'curry'], // エスカレーター 의 カレー 제외
  [/アイス|ソフトクリーム|ジェラート|かき氷/, 'icecream'],
  [/ケーキ|タルト|パフェ|プリン|シュー|ティラミス|ワッフル|クレープ/, 'cake'],
  [/団子|だんご|餅|もち|大福|わらび|ぜんざい|あんみつ|デザート|甘味|抹茶/, 'dessert'],
  [/枝豆|えだまめ/, 'edamame'],
  [/豆腐|冷奴|湯豆腐|厚揚げ|揚げ出し/, 'tofu'],
  [/海老|えび|エビ|海老天/, 'shrimp'],
  [/いか|イカ|烏賊|たこ|タコ|蛸|たこ焼/, 'squid'],
  [/豚|ぶた|ポーク|トンカツ|とんかつ|ベーコン|ハム|ソーセージ|ウインナー/, 'pork'],
  [/牛|ビーフ|ステーキ|ハラミ|カルビ|タン|ホルモン|もつ|レバー/, 'meat'],
  [/ロース|バラ|カツ/, 'pork'],
  [/鶏|とり|チキン|もも|手羽|ささみ|軟骨|砂肝/, 'chicken'],
  // ブリ 는 ブリュット(와인)·ブリオッシュ 안에도 들어가므로 뒤 글자를 본다
  [/魚|鮭|サーモン|鯖|さば|サバ|さんま|秋刀魚|鯛|あじ|アジ|ぶり|ブリ(?![ュオッ])|まぐろ|マグロ|貝|牡蠣|カキ|ホタテ|あさり|しじみ|にしん|ツナ/, 'fish'],
  [/うずら|卵|玉子|たまご|エッグ/, 'egg'],
  [/チーズ|ピザ|ビザ|グラタン|カルツォーネ/, 'cheese'],
  [/茄子|なす|ナス/, 'eggplant'],
  [/椎茸|しいたけ|きのこ|キノコ|エリンギ|舞茸|しめじ/, 'mushroom'],
  [/じゃが|ジャガ|ポテト|芋|いも|コロッケ|フライドポテト/, 'potato'],
  [/ししとう|唐辛子|ピーマン|パプリカ/, 'pepper'],
  [/とうもろこし|コーン/, 'corn'],
  [/野菜|キャベツ|漬物|つけもの|つけ物|お新香|キムチ|きゅうり|キュウリ|レタス|オクラ|トマト|アスパラ|玉ねぎ|ねぎ|もやし|ほうれん|生姜|しょうが|海藻|わかめ/, 'salad'],
  [/汁/, 'soup'],
  [/丼|ご飯|ごはん|ライス|おにぎり|お握り|チャーハン|炒飯|定食|弁当/, 'rice'],
];

/** 모델이 목록 밖의 단어를 쓸 때를 대비한 별칭 */
const ALIASES: Record<string, string> = {
  beef: 'meat', steak: 'meat', lamb: 'meat', yakiniku: 'meat', offal: 'meat', bacon: 'pork', ham: 'pork', sausage: 'pork',
  prawn: 'shrimp', octopus: 'squid', seafood: 'fish', salmon: 'fish', tuna: 'sashimi', omelette: 'tamago', omelet: 'tamago', quail: 'egg',
  vegetable: 'salad', vegetables: 'salad', pickles: 'salad', kimchi: 'salad', noodle: 'ramen', noodles: 'ramen', soba: 'udon',
  onigiri: 'rice', donburi: 'rice', bowl: 'rice', miso: 'soup', stew: 'soup', hotpot: 'soup', shochu: 'sake', makgeolli: 'sake',
  whisky: 'highball', whiskey: 'highball', cocktail: 'highball', champagne: 'wine', sparkling: 'wine', sangria: 'wine',
  tea: 'drink', water: 'drink', latte: 'coffee', espresso: 'coffee', cola: 'soda', lemonade: 'juice', smoothie: 'cup', boba: 'cup', bubble_tea: 'cup', milk_tea: 'cup', frappe: 'cup',
  milk: 'mug', cocoa: 'mug', hot_chocolate: 'mug',
  mochi: 'dessert', dango: 'dessert', fruit: 'juice', pudding: 'cake', parfait: 'cake', toast: 'bread', burger: 'bread', pizza: 'cheese', fries: 'potato', croquette: 'potato',
};

/** 재료가 아닌 뭉뚱그린 아이콘. 키워드 규칙이 이 중 하나를 고르고 모델이 더 구체적인 재료를 골랐으면 모델을 따른다 */
const GENERIC = new Set(['drink', 'dessert', 'salad', 'soup', 'rice', 'dish', 'cake', 'cup']);

/** 키워드도 안 걸리고 모델도 뭉뚱그린 것만 골랐을 때의 자리표시. 이 값이면 ItemImage 가 생성을 요청한다 */
export const PLACEHOLDER_ICON = 'camera';

const BY_CATEGORY: Record<Category, string> = { 안주: PLACEHOLDER_ICON, 식사: PLACEHOLDER_ICON, 음료: 'cup', 디저트: 'cake', 기타: 'dish' };

const normalizeKey = (icon: string | undefined): string => (icon ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');

/** 음료 판정: 음료 칸이거나, 모델이 음료 아이콘을 골랐으면 음료 규칙만 쓴다 */
const isDrink = (key: string, category: Category): boolean => category === '음료' || DRINK_ICONS.has(key);

/**
 * 원문 키워드 → 모델 선택 → 별칭 → 카테고리 기본값 순으로 아이콘을 정한다.
 * 음료는 음료 규칙으로만 판정해 「アイス(차가운)」「ソーダ割(소다로 탄 소주)」가 음식 규칙에 걸리지 않게 한다.
 */
export const resolveIcon = (nameJa: string, icon: string | undefined, category: Category): string => {
  const key = normalizeKey(icon);
  const modelKey = ICON_KEYS.has(key) ? key : (ALIASES[key] ?? null);
  const drink = isDrink(modelKey ?? key, category);
  const hit = (drink ? DRINK_RULES : FOOD_RULES).find(([re]) => re.test(nameJa));
  if (hit) {
    // 예: 茶美豚バラ → 규칙은 drink(茶), 모델은 pork. 뭉뚱그린 규칙보다 구체적인 모델 선택을 믿는다
    if (GENERIC.has(hit[1]) && modelKey !== null && !GENERIC.has(modelKey)) return modelKey;
    return hit[1];
  }
  if (modelKey !== null) {
    if (drink) return GENERIC.has(modelKey) ? 'cup' : modelKey;
    // 모델이 구체적인 재료를 골랐으면 쓰고, 뭉뚱그린 것(dish·rice 등)이면 자리표시 → 생성
    return GENERIC.has(modelKey) && category !== '디저트' && category !== '기타' ? PLACEHOLDER_ICON : modelKey;
  }
  return BY_CATEGORY[category] ?? PLACEHOLDER_ICON;
};
