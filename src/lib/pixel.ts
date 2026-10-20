/** 도트 격자(16줄×16칸 문자) → box-shadow. 팔레트는 scripts/px_icons.py 와 같다. 생성된 아이콘을 런타임에 그릴 때 쓴다. */
export const PALETTE: Record<string, string> = {
  k: '#2A211B',
  o: '#A8692E',
  O: '#E8B04A',
  y: '#F2D06B',
  Y: '#FFF0B0',
  p: '#D98B7A',
  P: '#F3C5B8',
  g: '#5F9E5C',
  G: '#8CC98A',
  r: '#C8402F',
  w: '#F4EBD9',
  f: '#FFF8E7',
  s: '#EF8F6A',
  a: '#D99A3A',
  b: '#2E4A7A',
  B: '#7FA3D6',
  m: '#8E3A2F',
  c: '#C9B79C',
  d: '#5A5047',
  v: '#5B3A7A',
};

export const gridToShadow = (grid: readonly string[]): string =>
  grid.flatMap((row, y) => [...row].flatMap((ch, x) => (PALETTE[ch] ? [`${x}em ${y}em ${PALETTE[ch]}`] : []))).join(',');

export const isGrid = (v: unknown): v is readonly string[] => Array.isArray(v) && v.length === 16 && v.every((r) => typeof r === 'string' && r.length === 16);
