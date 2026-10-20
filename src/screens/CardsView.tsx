import { useState } from 'react';
import type { Category, ImageMode, MenuItem, Rate, Scan } from '../types';
import { formatJpy, formatKrw } from '../lib/money';
import { ItemImage } from '../components/ItemImage';
import { Segmented } from '../components/Segmented';

type Filter = '전체' | Category | '매운맛';
const FILTERS: readonly Filter[] = ['전체', '안주', '식사', '음료', '디저트', '기타', '매운맛'];

type Props = { readonly scan: Scan; readonly rate: Rate | null; readonly mode: ImageMode; readonly onMode: (m: ImageMode) => void; readonly onSelect: (item: MenuItem) => void };

const matches = (it: MenuItem, f: Filter): boolean => f === '전체' || (f === '매운맛' ? it.tags.includes('매움') : it.category === f);

export const CardsView = ({ scan, rate, mode, onMode, onSelect }: Props) => {
  const [filter, setFilter] = useState<Filter>('전체');
  const present = new Set(scan.items.map((i) => i.category));
  const filters = FILTERS.filter((f) => f === '전체' || f === '매운맛' ? true : present.has(f));
  const list = scan.items.filter((it) => matches(it, filter));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="filters" role="group" aria-label="분류">
        {filters.map((f) => (
          <button key={f} type="button" className="seg__btn" aria-pressed={filter === f} onClick={() => setFilter(f)} style={f === '매운맛' && filter !== f ? { color: 'var(--vermilion)' } : undefined}>{f}</button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted small">대표 이미지</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted" style={{ fontSize: 10 }}>사진은 준비 중</span>
          <Segmented size="small" label="대표 이미지 종류" value={mode} onChange={onMode} options={[{ value: 'art', label: '그림' }, { value: 'photo', label: '사진', disabled: true }]} />
        </div>
      </div>
      {scan.notes.length > 0 && filter === '전체' && (
        <section style={{ background: 'var(--paper-dark)', border: '2px solid var(--ink)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="dot" style={{ fontSize: 11, color: 'var(--vermilion)', letterSpacing: '0.1em' }}>메뉴판 문구</span>
          {scan.notes.map((n, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{n.text_ko}</span>
              <span className="jp muted" style={{ fontSize: 12, fontWeight: 500 }}>{n.text_ja}</span>
            </div>
          ))}
        </section>
      )}
      {list.length === 0 && <div className="muted small" style={{ textAlign: 'center', padding: 20 }}>해당하는 메뉴가 없어요</div>}
      {list.map((it) => (
        <article key={it.id} className="frame" style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'center' }}>
          <ItemImage item={it} mode={mode} size={76} />
          <button type="button" onClick={() => onSelect(it)} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span className="jp" style={{ fontSize: 17 }}>{it.name_ja}</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                <span className="dot" style={{ fontSize: 15, color: 'var(--vermilion)' }}>{formatJpy(it.price_jpy)}</span>
                {formatKrw(it.price_jpy, rate) && <span className="muted" style={{ fontSize: 10 }}>{formatKrw(it.price_jpy, rate)}</span>}
              </span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{it.name_ko}</span>
            {it.desc_ko
              ? <span style={{ fontSize: 12, color: 'var(--body)', lineHeight: 1.45 }}>{it.desc_ko}</span>
              : !it.detailed && scan.status !== 'done' && <span className="muted" style={{ fontSize: 12 }}>설명 쓰는 중<span className="blink">▌</span></span>}
            {it.tags.length > 0 && (
              <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {it.tags.map((t) => <span key={t} className={`chip${t === '매움' ? ' chip--accent' : ''}`}>{t}</span>)}
              </span>
            )}
          </button>
        </article>
      ))}
    </div>
  );
};
