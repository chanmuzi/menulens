import { useState } from 'react';
import type { ImageMode, MenuItem, Rate, Scan, Tag } from '../types';
import { formatKrw, formatPrice, payableJpy } from '../lib/money';
import { ItemImage } from '../components/ItemImage';
import { Segmented } from '../components/Segmented';
import { QtyStepper } from '../components/QtyStepper';
import type { Order } from '../lib/order';

import { groupItems, groupsPending, REST, type Group } from '../lib/groups';
import { useT, tagLabel } from '../i18n';

/** 전체 · 묶음(g:라벨) · 매운맛 */
type Filter = '전체' | '매운맛' | `g:${string}`;

type Props = { readonly scan: Scan; readonly rate: Rate | null; readonly mode: ImageMode; readonly onMode: (m: ImageMode) => void; readonly onSelect: (item: MenuItem) => void; readonly order: Order; readonly onQty: (id: string, qty: number) => void };


/** 카드에 보여줄 배지는 고르는 데 도움이 되는 것만 최대 2개(사용자 결정 2026-10-21). 음료·튀김·채식 같은 분류성 태그는 상세 시트에만 */
const BADGE_PRIORITY: readonly Tag[] = ['매움', '날것', '선택 필요', '인기'];
const cardBadges = (tags: readonly string[]): readonly string[] => BADGE_PRIORITY.filter((t) => tags.includes(t)).slice(0, 2);

export const CardsView = ({ scan, rate, mode, onMode, onSelect, order, onQty }: Props) => {
  const t = useT();
  const [filter, setFilter] = useState<Filter>('전체');
  /** 묶음 이름 표시: 「그 밖에」와 category 값은 앱 언어로, 서버·모델이 지은 이름은 그대로 */
  const groupLabel = (g: Pick<Group, 'label'>): string => (g.label === REST ? t.result.groupRest : (t.data.category as Readonly<Record<string, string>>)[g.label] ?? g.label);
  // 묶음은 항목이 흘러드는 동안에도 계속 다시 계산된다(서버 정리 → 항목 group → category)
  const groups = groupItems(scan.items, scan.groups);
  const hasSpicy = scan.items.some((it) => it.tags.includes('매움'));
  // 서버 정리가 올 수 있는 동안은 묶음 칩·헤더를 숨긴다(도착하면 이름이 바뀌어 보던 목록이 튄다)
  const pending = groupsPending(scan);
  const filters: readonly { readonly value: Filter; readonly label: string }[] = [
    { value: '전체', label: t.result.filterAll },
    ...(pending ? [] : groups.map((g) => ({ value: g.key as Filter, label: groupLabel(g) }))),
    ...(hasSpicy ? [{ value: '매운맛' as Filter, label: t.result.filterSpicy }] : []),
  ];
  // 고른 묶음이 사라지면(항목 재계산) 전체로
  const active = filters.some((f) => f.value === filter) ? filter : '전체';
  const sections = active === '전체' ? groups : active === '매운맛'
    ? [{ key: 'spicy', label: t.result.filterSpicy, items: scan.items.filter((it) => it.tags.includes('매움')) }]
    : groups.filter((g) => g.key === active);
  const showHeaders = active === '전체' && groups.length > 1 && !pending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {scan.kind === 'menu' && filters.length > 2 && <div className="filters" role="group" aria-label={t.result.filtersAria}>
        {filters.map((f) => (
          <button key={f.value} type="button" className="seg__btn" aria-pressed={active === f.value} onClick={() => setFilter(f.value)} style={f.value === '매운맛' && active !== f.value ? { color: 'var(--vermilion)' } : undefined}>{f.label}</button>
        ))}
      </div>}
      {scan.kind === 'menu' && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted small">{t.result.repImage}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted" style={{ fontSize: 10 }}>{t.result.photoPreparing}</span>
          <Segmented size="small" label={t.result.repImageKind} value={mode} onChange={onMode} options={[{ value: 'art', label: t.result.modeArt }, { value: 'photo', label: t.result.modePhoto, disabled: true }]} />
        </div>
      </div>}
      {sections.every((g) => g.items.length === 0) && <div className="muted small" style={{ textAlign: 'center', padding: 20 }}>{t.result.noMatch}</div>}
      {sections.flatMap((g) => [
        showHeaders && g.items.length > 0 ? (
          <div key={g.key} className="dot" style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6, fontSize: 14 }}>
            <span style={{ color: 'var(--vermilion)' }}>▪</span>{groupLabel(g)}<span className="muted" style={{ fontSize: 11 }}>{g.items.length}</span>
          </div>
        ) : null,
        ...g.items.map((it) => (
        <article key={it.id} className="frame" style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'flex-start' }}>
          {/* 왼쪽 열: 그림 + 작은 배지(그림 폭 안). 본문 아래 빈 줄 대신 여기서 세로 공간을 쓴다 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch', width: 76, flexShrink: 0 }}>
            <ItemImage item={it} mode={mode} size={76} />
            {cardBadges(it.tags).map((tag) => (
              <span key={tag} className={`chip chip--mini${tag === '매움' ? ' chip--accent' : ''}`}>{tagLabel(t, tag)}</span>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'stretch' }}>
          <button type="button" onClick={() => onSelect(it)} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span className="jp" style={{ fontSize: 17 }}>{it.name_ja}</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                {(payableJpy(it) !== null || it.category !== '기타') && <span className="dot" style={{ fontSize: 15, color: 'var(--vermilion)', whiteSpace: 'nowrap' }}>{formatPrice(it)}</span>}
                {formatKrw(payableJpy(it), rate) && <span className="muted" style={{ fontSize: 10 }}>{formatKrw(payableJpy(it), rate)}{it.price_tax_jpy !== null ? ` ${t.result.taxIncluded}` : ''}</span>}
              </span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{it.name_ko}</span>
            {it.desc_ko
              ? <span style={{ fontSize: 12, color: 'var(--body)', lineHeight: 1.45 }}>{it.desc_ko}</span>
              : !it.detailed && scan.status !== 'done' && <span className="muted" style={{ fontSize: 12 }}>{t.result.writingDesc}<span className="blink">▌</span></span>}
          </button>
          {scan.kind === 'menu' && it.category !== '기타' && (
            // 카드 오른쪽 아래. 태그 줄이 사라져 이 줄이 본문 바로 아래에 붙는다
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
              <QtyStepper qty={order[it.id] ?? 0} onChange={(q) => onQty(it.id, q)} label={it.name_ko} size="small" />
            </div>
          )}
          </div>
        </article>
        )),
      ])}
    </div>
  );
};
