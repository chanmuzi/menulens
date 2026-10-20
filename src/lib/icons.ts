import type { Category } from '../types';

export const ICON_KEYS = new Set([
  'ramen', 'udon', 'gyoza', 'karaage', 'beer', 'highball', 'sake', 'sashimi', 'sushi',
  'yakitori', 'meat', 'pork', 'chicken', 'shrimp', 'squid', 'fish', 'egg', 'tamago', 'tofu',
  'edamame', 'eggplant', 'mushroom', 'potato', 'pepper', 'corn', 'salad', 'cheese',
  'rice', 'curry', 'soup', 'dessert', 'drink', 'dish',
]);

/**
 * 원문 키워드 → 아이콘. 모델의 선택보다 우선한다 (같은 재료는 항상 같은 그림이 나오도록).
 * 앞에 있는 규칙이 이긴다: 구체적인 요리명을 재료명보다 먼저 둔다.
 */
const KEYWORDS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ラーメン|らーめん|拉麺|つけ麺|中華そば/, 'ramen'],
  [/うどん|饂飩|そば|蕎麦|焼きそば|焼そば|パスタ/, 'udon'],
  [/餃子|ぎょうざ|ギョーザ|焼売|シュウマイ/, 'gyoza'],
  [/唐揚|から揚|からあげ|竜田/, 'karaage'],
  [/焼鳥|焼き鳥|やきとり|つくね|ねぎま/, 'yakitori'],
  [/刺身|さしみ|造り/, 'sashimi'],
  [/寿司|鮨|すし|握り|巻き/, 'sushi'],
  [/だし巻|出汁巻|玉子焼|卵焼|オムレツ|オムライス/, 'tamago'],
  [/ハイボール|サワー|チューハイ|酎ハイ|レモンサワー|カクテル|ウイスキー/, 'highball'],
  [/ビール|生中|生ビ|ビア/, 'beer'],
  [/日本酒|冷酒|熱燗|焼酎|梅酒|ワイン|酒/, 'sake'],
  [/茶|コーヒー|珈琲|ジュース|コーラ|ソーダ|ウーロン|水|ドリンク/, 'drink'],
  [/アイス|ケーキ|パフェ|プリン|団子|だんご|餅|もち|デザート|甘味|抹茶/, 'dessert'],
  [/カレー|カツカレー/, 'curry'],
  [/枝豆|えだまめ/, 'edamame'],
  [/豆腐|冷奴|湯豆腐|厚揚げ|揚げ出し/, 'tofu'],
  [/海老|えび|エビ|海老天/, 'shrimp'],
  [/いか|イカ|烏賊|たこ|タコ|蛸|たこ焼/, 'squid'],
  [/豚|ぶた|ポーク|トンカツ|とんかつ|ベーコン|ハム|ソーセージ|ウインナー/, 'pork'],
  [/牛|ビーフ|ステーキ|ハラミ|カルビ|タン|ホルモン|もつ|レバー/, 'meat'],
  [/ロース|バラ|カツ/, 'pork'],
  [/鶏|とり|チキン|もも|手羽|ささみ|軟骨|砂肝/, 'chicken'],
  [/うずら|卵|玉子|たまご|エッグ/, 'egg'],
  [/チーズ|ピザ|グラタン/, 'cheese'],
  [/茄子|なす|ナス/, 'eggplant'],
  [/椎茸|しいたけ|きのこ|キノコ|エリンギ|舞茸|しめじ/, 'mushroom'],
  [/じゃが|ジャガ|ポテト|芋|いも|コロッケ|フライドポテト/, 'potato'],
  [/ししとう|唐辛子|ピーマン|パプリカ/, 'pepper'],
  [/とうもろこし|コーン/, 'corn'],
  [/魚|鮭|サーモン|鯖|さば|サバ|さんま|秋刀魚|鯛|あじ|アジ|ぶり|ブリ|まぐろ|マグロ|貝|牡蠣|カキ|ホタテ|あさり|しじみ/, 'fish'],
  [/サラダ|野菜|キャベツ|漬物|お新香|キムチ|きゅうり|トマト|アスパラ|玉ねぎ|ねぎ|もやし|ほうれん|生姜|しょうが|海藻|わかめ/, 'salad'],
  [/味噌汁|みそ汁|スープ|鍋|おでん|汁|雑炊/, 'soup'],
  [/丼|ご飯|ごはん|ライス|おにぎり|お握り|チャーハン|炒飯|定食|弁当/, 'rice'],
];

/** 모델이 목록 밖의 단어를 쓸 때를 대비한 별칭 */
const ALIASES: Record<string, string> = {
  beef: 'meat', steak: 'meat', lamb: 'meat', yakiniku: 'meat', offal: 'meat', bacon: 'pork', ham: 'pork', sausage: 'pork',
  prawn: 'shrimp', octopus: 'squid', seafood: 'fish', salmon: 'fish', tuna: 'sashimi', omelette: 'tamago', omelet: 'tamago', quail: 'egg',
  vegetable: 'salad', vegetables: 'salad', pickles: 'salad', kimchi: 'salad', noodle: 'ramen', noodles: 'ramen', soba: 'udon',
  onigiri: 'rice', donburi: 'rice', bowl: 'rice', miso: 'soup', stew: 'soup', hotpot: 'soup', wine: 'sake', shochu: 'sake',
  whisky: 'highball', cocktail: 'highball', tea: 'drink', coffee: 'drink', juice: 'drink', soda: 'drink', water: 'drink',
  icecream: 'dessert', cake: 'dessert', mochi: 'dessert', fruit: 'dessert', bread: 'dish', pizza: 'cheese', fries: 'potato', croquette: 'potato',
};

const BY_CATEGORY: Record<Category, string> = { 안주: 'dish', 식사: 'rice', 음료: 'drink', 디저트: 'dessert', 기타: 'dish' };

/** 원문 키워드 → 모델 선택 → 별칭 → 카테고리 기본값 순으로 아이콘을 정한다. */
export const resolveIcon = (nameJa: string, icon: string | undefined, category: Category): string => {
  const hit = KEYWORDS.find(([re]) => re.test(nameJa));
  if (hit) return hit[1];
  const key = (icon ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (ICON_KEYS.has(key)) return key;
  const alias = ALIASES[key];
  if (alias) return alias;
  return BY_CATEGORY[category] ?? 'dish';
};
