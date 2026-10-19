import type { Category } from '../types';

export const ICON_KEYS = new Set([
  'ramen', 'udon', 'gyoza', 'karaage', 'beer', 'highball', 'sake', 'sashimi', 'sushi',
  'yakitori', 'meat', 'pork', 'chicken', 'shrimp', 'squid', 'fish', 'egg', 'tamago', 'tofu',
  'edamame', 'eggplant', 'mushroom', 'potato', 'pepper', 'corn', 'salad', 'cheese',
  'rice', 'curry', 'soup', 'dessert', 'drink', 'dish',
]);

/** 모델이 목록 밖의 단어를 쓸 때를 대비한 별칭 */
const ALIASES: Record<string, string> = {
  beef: 'meat', steak: 'meat', tongue: 'meat', lamb: 'meat', yakiniku: 'meat', horumon: 'meat', offal: 'meat',
  bacon: 'pork', ham: 'pork', sausage: 'pork', tonkatsu: 'pork',
  bird: 'chicken', wing: 'chicken', tsukune: 'yakitori', skewer: 'yakitori',
  prawn: 'shrimp', ebi: 'shrimp', tempura: 'shrimp', octopus: 'squid', ika: 'squid', takoyaki: 'squid',
  seafood: 'fish', salmon: 'fish', tuna: 'sashimi', mackerel: 'fish', eel: 'fish', oyster: 'fish', clam: 'fish', crab: 'fish',
  omelette: 'tamago', omelet: 'tamago', quail: 'egg',
  vegetable: 'salad', vegetables: 'salad', veggie: 'salad', cabbage: 'salad', pickles: 'salad', kimchi: 'salad', seaweed: 'salad', cucumber: 'salad', tomato: 'salad', onion: 'salad', asparagus: 'salad', ginger: 'salad',
  bean: 'edamame', beans: 'edamame', soybean: 'edamame',
  noodle: 'ramen', noodles: 'ramen', soba: 'udon', yakisoba: 'udon', pasta: 'udon',
  onigiri: 'rice', donburi: 'rice', fried_rice: 'rice', chahan: 'rice', bowl: 'rice',
  miso: 'soup', stew: 'soup', oden: 'soup', hotpot: 'soup', nabe: 'soup',
  wine: 'sake', shochu: 'sake', whisky: 'highball', cocktail: 'highball', sour: 'highball', lemon_sour: 'highball',
  tea: 'drink', coffee: 'drink', juice: 'drink', soda: 'drink', water: 'drink',
  icecream: 'dessert', ice_cream: 'dessert', cake: 'dessert', mochi: 'dessert', parfait: 'dessert', fruit: 'dessert',
  bread: 'dish', pizza: 'cheese', gratin: 'cheese', fries: 'potato', croquette: 'potato', korokke: 'potato',
};

const BY_CATEGORY: Record<Category, string> = { 안주: 'dish', 식사: 'rice', 음료: 'drink', 디저트: 'dessert' };

/** 모델이 준 아이콘 키 → 목록 키. 없으면 별칭, 그래도 없으면 카테고리 기본값. */
export const resolveIcon = (icon: string | undefined, category: Category): string => {
  const key = (icon ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (ICON_KEYS.has(key)) return key;
  const alias = ALIASES[key];
  if (alias) return alias;
  const partial = [...ICON_KEYS].find((k) => key.includes(k));
  return partial ?? BY_CATEGORY[category] ?? 'dish';
};
