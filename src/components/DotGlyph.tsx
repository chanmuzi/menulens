/** 작은 도트 글리프(10×10). 기록 줄의 이름 고치기(먹색 연필)·지우기(주홍 휴지통)에 쓴다. */
const GLYPHS = {
  pencil: { color: 'var(--ink)', rows: ['.......##.', '......#..#', '.....#.##.', '....#.##..', '...#.##...', '..#.##....', '.#.##.....', '#.##......', '##........', '..........'] },
  trash: { color: 'var(--vermilion)', rows: ['...####...', '##########', '..........', '.########.', '.#.#..#.#.', '.#.#..#.#.', '.#.#..#.#.', '.#.#..#.#.', '.########.', '..........'] },
} as const;

export type GlyphName = keyof typeof GLYPHS;

export const DotGlyph = ({ name, size = 12 }: { readonly name: GlyphName; readonly size?: number }) => {
  const { color, rows } = GLYPHS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" shapeRendering="crispEdges" aria-hidden="true" style={{ display: 'block' }}>
      {rows.flatMap((row, y) => [...row].flatMap((c, x) => (c === '#' ? [<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />] : [])))}
    </svg>
  );
};
