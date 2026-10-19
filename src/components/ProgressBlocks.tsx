type Props = { readonly filled: number; readonly total: number; readonly active: boolean };

/** 픽셀 게이지. 다음 칸은 진행 중일 때 깜빡인다. */
export const ProgressBlocks = ({ filled, total, active }: Props) => {
  const n = Math.max(total, filled + (active ? 1 : 0), 1);
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={filled} aria-label={`메뉴 ${filled}개 찾음`} style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: n }, (_, i) => {
        const state = i < filled ? 'done' : i === filled && active ? 'next' : 'todo';
        return (
          <div
            key={i}
            className={state === 'next' ? 'block--next' : undefined}
            style={{ flex: '1 1 0', height: 14, border: '2px solid var(--ink)', background: state === 'done' ? 'var(--vermilion)' : 'var(--paper-dark)' }}
          />
        );
      })}
    </div>
  );
};
