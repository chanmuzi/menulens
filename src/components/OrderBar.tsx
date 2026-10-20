/** 하단 고정 주문서 바(토스 주문서 느낌): 개수 · 합계 · 「주문 문구」 버튼. 1개 이상 담겼을 때만 보인다. */
import type { Rate } from '../types';
import { formatJpy } from '../lib/money';
import { totalCount, totalJpy, totalKrw, type OrderLine } from '../lib/order';

type Props = { readonly lines: readonly OrderLine[]; readonly rate: Rate | null; readonly onOpen: () => void };

export const OrderBar = ({ lines, rate, onOpen }: Props) => {
  const count = totalCount(lines);
  if (count === 0) return null;
  const [jpy, hasUnknown] = totalJpy(lines);
  const krw = totalKrw(jpy, rate);
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 15, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ pointerEvents: 'auto', width: '100%', maxWidth: 480, margin: '0 12px', marginBottom: 'calc(12px + var(--safe-bottom))', background: 'var(--ink)', color: 'var(--paper)', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--vermilion)', padding: '10px 10px 10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="dot" style={{ fontSize: 12, opacity: .8 }}>주문서 · {count}개</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span className="dot" style={{ fontSize: 18 }}>{formatJpy(jpy)}{hasUnknown ? '+' : ''}</span>
            {krw !== null && <span style={{ fontSize: 12, opacity: .8 }}>≈ ₩{krw.toLocaleString('ko-KR')}</span>}
          </span>
        </div>
        <button type="button" className="btn btn--primary" onClick={onOpen} style={{ boxShadow: 'none', minHeight: 40, fontWeight: 600 }}>주문 문구</button>
      </div>
    </div>
  );
};
