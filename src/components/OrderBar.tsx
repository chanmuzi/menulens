/** 하단 고정 주문서 바(토스 주문서 느낌): 개수 · 합계 · 「주문 문구」 버튼. 1개 이상 담겼을 때만 보인다. 높이를 재서 알려 주어 말풍선 버튼이 그 위에 앉는다. */
import { useLayoutEffect, useRef } from 'react';
import type { Rate } from '../types';
import { formatConverted, formatMoney } from '../lib/money';
import { linesCurrency, total, totalCount, type OrderLine } from '../lib/order';
import { useT } from '../i18n';

/** 바 아래 여백(px, 안전 영역 제외). 높이 보고에 포함한다 */
const BAR_MARGIN = 12;

type Props = { readonly lines: readonly OrderLine[]; readonly rate: Rate | null; readonly onOpen: () => void; /** 바의 실제 높이(아래 여백 포함, 안전 영역 제외). 바가 사라지면 0. 글꼴·행간에 따라 달라지므로 상수로 가정하지 않는다. 참조가 바뀌면 다시 재며 그 사이 0 을 한 번 보내므로 setState 처럼 안정된 함수를 넘긴다 */ readonly onHeight: (px: number) => void };

export const OrderBar = ({ lines, rate, onOpen, onHeight }: Props) => {
  const t = useT();
  const count = totalCount(lines);
  const boxRef = useRef<HTMLDivElement>(null);
  const shown = count > 0;
  // 그리기 전에 재서 버튼이 바 위에 걸친 채 한 프레임 보이지 않게 한다
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!shown || !el) return;
    const report = () => onHeight(el.offsetHeight + BAR_MARGIN);
    report();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(report) : null;
    ro?.observe(el);
    return () => { ro?.disconnect(); onHeight(0); };
  }, [shown, onHeight]);
  if (!shown) return null;
  const [sum, hasUnknown] = total(lines);
  const currency = linesCurrency(lines);
  const converted = formatConverted(sum, currency, rate);
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 15, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <div ref={boxRef} style={{ pointerEvents: 'auto', width: '100%', maxWidth: 480, margin: '0 12px', marginBottom: `calc(${BAR_MARGIN}px + var(--safe-bottom))`, background: 'var(--ink)', color: 'var(--paper)', border: '2px solid var(--ink)', boxShadow: '4px 4px 0 var(--vermilion)', padding: '10px 10px 10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="dot" style={{ fontSize: 12, opacity: .8 }}>{t.order.barTitle(count)}</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span className="dot" style={{ fontSize: 18 }}>{formatMoney(sum, currency)}{hasUnknown ? '+' : ''}</span>
            {converted && <span style={{ fontSize: 12, opacity: .8 }}>{converted}</span>}
          </span>
        </div>
        <button type="button" className="btn btn--primary" onClick={onOpen} style={{ boxShadow: 'none', minHeight: 40, fontWeight: 600 }}>{t.order.orderPhrase}</button>
      </div>
    </div>
  );
};
