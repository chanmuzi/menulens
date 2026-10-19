import type { ReactNode } from 'react';

type Option<T extends string> = { readonly value: T; readonly label: ReactNode; readonly disabled?: boolean };

type Props<T extends string> = {
  readonly value: T;
  readonly options: readonly Option<T>[];
  readonly onChange: (v: T) => void;
  readonly size?: 'default' | 'small';
  readonly shadow?: boolean;
  readonly label: string;
};

export const Segmented = <T extends string>({ value, options, onChange, size = 'default', shadow = false, label }: Props<T>) => (
  <div className={`seg${shadow ? ' seg--shadow' : ''}`} role="group" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={`seg__btn${size === 'small' ? ' seg__btn--small' : ''}`}
        aria-pressed={o.value === value}
        disabled={o.disabled}
        onClick={() => onChange(o.value)}
        style={o.disabled ? { color: 'var(--muted)', opacity: 0.6, cursor: 'default' } : undefined}
      >
        {o.label}
      </button>
    ))}
  </div>
);
