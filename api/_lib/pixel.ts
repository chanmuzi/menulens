/**
 * 도트 아이콘 생성용 팔레트·검증·프롬프트. 팔레트는 scripts/px_icons.py 와 같다 (바꾸면 둘 다).
 * 아이콘은 16×16 문자 격자(문자 하나 = 픽셀, '.' = 투명)로 주고받는다. 이미지 생성 모델 없이 LLM 텍스트로 만든다.
 */
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

export const GRID = 16;

/** 모델 출력에서 격자만 꺼내 검증한다. 16줄×16칸, 팔레트 문자와 '.' 만, 외곽선(k)이 있고 너무 비어 있지 않아야 한다 */
export const parseGrid = (text: string): readonly string[] | null => {
  const allowed = new Set([...Object.keys(PALETTE), '.']);
  const rows = text.replace(/```[a-z]*/g, '').split('\n').map((l) => l.trim()).filter((l) => l.length === GRID && [...l].every((ch) => allowed.has(ch)));
  if (rows.length < GRID) return null;
  const grid = rows.slice(0, GRID);
  const filled = grid.join('').replace(/\./g, '').length;
  if (filled < 40 || !grid.join('').includes('k')) return null;
  return grid;
};

const EX1 = `................
................
.....kkk........
....kooook.kkk..
...koOOOook.GGk.
...koOooOOkoGGk.
..kooOOooooOOok.
..koOOoooOoooOk.
..kooooOOoooook.
...koooooooook..
....kkkkkkkkk...
..kwwwwwwwwwwwk.
.kwwwwwwwwwwwwwk
..kkkkkkkkkkkkk.
................
................`;
const EX2 = `................
...kkkkkkkk.....
..kffffffffk....
..kffffffffk....
..kffffffffkkk..
..kyyyyyyyykaak.
..kyyyyyyyykaak.
..kyyyyyyyykaak.
..kyyyyyyyykaak.
..kyyyyyyyyk.k..
..kyyYyyyyyk....
..kyyYyyyyyk....
..kyyyyyyyyk....
..kkkkkkkkkk....
................
................`;

/** 생성 지시. 화풍을 고정하는 것이 핵심: 먹색 외곽선, 2~3색, 중앙 배치, 접시선 */
export const ICON_SYSTEM = `당신은 「MenuLens」 앱의 도트 아이콘 작가입니다. 일본 식당 메뉴 하나를 16×16 픽셀 아이콘으로 그립니다.
출력은 정확히 16줄, 각 줄 16글자. 글자 하나가 픽셀 하나이며 '.' 은 투명입니다. 설명·코드펜스·빈 줄 없이 격자만 출력하세요.

팔레트(이 문자만 사용):
${Object.entries(PALETTE).map(([k, v]) => `${k}=${v}`).join(', ')}
k 먹색(외곽선·그림자), o 갈색, O 밝은 황금(튀김·빵), y 노랑, Y 연노랑, p 분홍(차슈·햄), P 연분홍, g 초록, G 연초록, r 주홍, w 종이색, f 흰색(밥·거품), s 연어색, a 호박색, b 남색, B 연남색, m 적갈(고기), c 베이지, d 회갈, v 보라

화풍 규칙:
1. 모든 덩어리는 k 로 1픽셀 외곽선을 두른다. 안쪽은 2~3색만. 하이라이트는 밝은 색 1~2픽셀.
2. 사물은 격자 중앙에 크게(가로 10~14픽셀), 위아래 1~2줄은 비워 둔다. 접시 위 음식이면 맨 아래에 k 로 접시선(1줄, 양끝 둥글게).
3. 정면 또는 약간 위에서 본 시점. 그림자·원근 없음. 글자 없음.
4. 요리의 가장 알아보기 쉬운 특징 하나를 과장한다 (예: 새우는 굽은 몸과 꼬리, 튀김은 울퉁불퉁한 황금 표면).

예시 1 (唐揚げ, 가라아게):
${EX1}

예시 2 (生ビール, 생맥주):
${EX2}`;

export const iconUserPrompt = (nameJa: string, nameKo: string, hint: string): string =>
  `메뉴: ${nameJa} (${nameKo})${hint ? `\n참고: ${hint}` : ''}\n이 메뉴의 아이콘 격자 16줄을 출력하세요.`;
