import type { MenuItem, Scan } from '../types';
import { formatJpy } from '../lib/money';
import { MenuPhoto } from '../components/MenuPhoto';

type Props = { readonly scan: Scan; readonly selectedId: string | null; readonly onSelect: (item: MenuItem) => void };

/** 메뉴가 이 수를 넘으면 칩 대신 번호 배지를 붙인다 */
const CHIP_LIMIT = 10;

const shortName = (s: string): string => s.replace(/\s*[(（].*?[)）]\s*$/, '').trim() || s;

/**
 * 메뉴판 사진 위에 번역을 붙인다.
 * 항목이 적으면 이름·가격 칩, 많으면 번호 배지(탭하면 상세). 세로쓰기가 빽빽하면 칩 높이를 3단으로 엇갈린다.
 */
export const OverlayView = ({ scan, selectedId, onSelect }: Props) => {
  const badges = scan.items.length > CHIP_LIMIT;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="frame" style={{ boxShadow: '4px 4px 0 var(--ink)', overflow: 'hidden' }}>
        <MenuPhoto src={scan.imageDataUrl} width={scan.width} height={scan.height} words={scan.words} rotation={scan.rotation} tilt={scan.tilt} maxHeight={620}>
          {scan.items.map((it, i) => {
            if (!it.bbox) return null;
            const [x0, y0, x1, y1] = it.bbox;
            const selected = it.id === selectedId;
            const vertical = y1 - y0 > (x1 - x0) * 2;
            const cx = (x0 + x1) / 2;
            if (badges) {
              // 글줄(이름+가격) 중앙에 배지를 둔다. 모델의 bbox 가 다소 부정확해도 줄 위치는 대체로 맞는다.
              const bx = cx;
              const by = (y0 + y1) / 2;
              const shift = `translate(-50%, -50%) rotate(${scan.rotation + scan.tilt}deg)`;
              return (
                <button key={it.id} type="button" onClick={() => onSelect(it)} aria-pressed={selected} aria-label={`${i + 1}번 ${it.name_ko} ${formatJpy(it.price_jpy)}`}
                  className="dot"
                  style={{ position: 'absolute', left: `${bx / 10}%`, top: `${by / 10}%`, transform: shift, width: 26, height: 26, padding: 0, cursor: 'pointer',
                    background: selected ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper)', border: '2px solid var(--paper-2)', boxShadow: '2px 2px 0 rgba(42,33,27,.6)', fontSize: 13, lineHeight: 1, zIndex: selected ? 3 : 1 }}>
                  {i + 1}
                </button>
              );
            }
            const lane = vertical ? i % 3 : 0;
            const top = vertical ? Math.min(y0 + 40 + lane * 95, 900) : Math.min(y1, 960);
            const align = `${cx < 200 ? 'translateX(-20%)' : cx > 800 ? 'translateX(-80%)' : 'translateX(-50%)'} rotate(${scan.rotation + scan.tilt}deg)`;
            return (
              <button key={it.id} type="button" onClick={() => onSelect(it)} aria-pressed={selected} aria-label={`${it.name_ko} ${formatJpy(it.price_jpy)}`}
                style={{ position: 'absolute', left: `${cx / 10}%`, top: `${top / 10}%`, transform: align, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '4px 7px', cursor: 'pointer',
                  background: selected ? 'var(--vermilion)' : 'var(--paper-2)', color: selected ? 'var(--paper-2)' : 'var(--ink)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', maxWidth: vertical ? '33%' : '46%', textAlign: 'left', zIndex: selected ? 3 : 1 }}>
                <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{shortName(it.name_ko)}</span>
                <span className="dot" style={{ fontSize: 11, lineHeight: 1 }}>{formatJpy(it.price_jpy)}</span>
              </button>
            );
          })}
        </MenuPhoto>
      </div>
      {badges ? (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 10px' }}>
          {scan.items.map((it, i) => (
            <li key={it.id}>
              <button type="button" onClick={() => onSelect(it)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: '4px 0', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                <span className="dot" style={{ width: 22, height: 22, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: it.id === selectedId ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper)', fontSize: 12 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortName(it.name_ko)}</span>
                <span className="dot muted" style={{ fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>{formatJpy(it.price_jpy)}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="muted small" style={{ textAlign: 'center' }}>칩을 탭하면 설명과 원화 가격이 열려요</div>
      )}
    </div>
  );
};
