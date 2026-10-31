/** 주문 문구 시트: 담은 목록·합계, 직원에게 보여줄 일본어(크게), 한글 발음, 뜻. 복사·비우기. 묶음이면 줄마다 어느 사진에서 담았는지 번호를 단다. */
import { useEffect, useState } from 'react';
import type { Rate } from '../types';
import { formatConverted, formatMoney, formatPrice } from '../lib/money';
import { buildOrderText, linesCurrency, orderModes, total, totalCount, type OrderLine, type OrderMode } from '../lib/order';
import { QtyStepper } from '../components/QtyStepper';
import { Segmented } from '../components/Segmented';
import { useT } from '../i18n';

type Props = { readonly lines: readonly OrderLine[]; readonly rate: Rate | null; /** 묶음의 사진 수. 2장 이상이면 줄에 「사진 N」 표시 */ readonly photos: number; readonly onQty: (scanId: string, id: string, qty: number) => void; readonly onClear: () => void; readonly onClose: () => void };

export const OrderSheet = ({ lines, rate, photos, onQty, onClear, onClose }: Props) => {
  const t = useT();
  const [big, setBig] = useState(false);
  const [copied, setCopied] = useState(false);
  // 상황(첫 주문·추가 주문·항목만). 시트를 열 때마다 첫 주문으로 시작한다
  const [mode, setMode] = useState<OrderMode>('first');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { if (lines.length === 0) onClose(); }, [lines.length, onClose]);

  const text = buildOrderText(lines, mode);
  const [sum, hasUnknown] = total(lines);
  const currency = linesCurrency(lines);
  const converted = formatConverted(sum, currency, rate);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text.ja); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 클립보드 불가 */ }
  };

  if (big) {
    // 직원에게 보여주는 화면: 일본어만 크게
    return (
      <div role="dialog" aria-modal="true" aria-label={t.order.bigAria} style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', padding: 'calc(16px + var(--safe-top)) 24px calc(16px + var(--safe-bottom))', gap: 16 }}>
        <div className="jp" style={{ flex: 1, fontSize: 30, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflow: 'auto', display: 'flex', alignItems: 'center' }}>{text.ja}</div>
        <button type="button" className="btn" onClick={() => setBig(false)}>{t.order.backFromBig}</button>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="order-title" style={{ position: 'fixed', inset: 0, zIndex: 25, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button type="button" aria-label={t.common.close} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '88dvh', overflow: 'auto', background: 'var(--paper-2)', borderTop: '3px solid var(--ink)', padding: '12px 20px calc(20px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div aria-hidden="true" style={{ width: 40, height: 4, background: 'var(--paper-dark)', alignSelf: 'center' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div id="order-title" className="dot" style={{ fontSize: 18 }}>{t.order.title} <span className="muted" style={{ fontSize: 13 }}>· {t.order.countSuffix(totalCount(lines))}</span></div>
          <button type="button" className="btn btn--quiet" onClick={onClear} style={{ minHeight: 32, padding: '0 6px' }}>{t.order.clear}</button>
        </div>

        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lines.map(({ scanId, photo, item, qty }) => (
            <li key={`${scanId}/${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.tr}</div>
                <div className={`${currency === 'JPY' ? 'jp ' : ''}muted`} style={{ fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name} · {formatPrice(item, currency)}</span>
                  {photos > 1 && <span className="dot" style={{ flexShrink: 0, fontSize: 10, padding: '0 4px', lineHeight: '16px', background: 'var(--ink)', color: 'var(--paper)' }}>{t.order.photoN(photo)}</span>}
                </div>
              </div>
              <QtyStepper qty={qty} onChange={(q) => onQty(scanId, item.id, q)} label={item.tr} size="small" />
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px dashed var(--ink)', paddingTop: 10 }}>
          <span className="dot" style={{ fontSize: 14 }}>{t.order.total}{hasUnknown ? ` ${t.order.excludeNoPrice}` : ''}</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="dot" style={{ fontSize: 20, color: 'var(--vermilion)' }}>{formatMoney(sum, currency)}</span>
            {converted && <span className="muted" style={{ fontSize: 12 }}>{converted}</span>}
          </span>
        </div>

        <div style={{ background: 'var(--paper-dark)', border: '2px solid var(--ink)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="dot small" style={{ color: 'var(--vermilion)' }}>{t.order.showStaff}</span>
            <Segmented size="small" label={t.order.modeLabel} value={mode} onChange={setMode} options={orderModes()} />
          </div>
          <p className="jp" style={{ margin: 0, fontSize: 17, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text.ja}</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text.pron}</p>
          <p className="muted small" style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text.ko}</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => void copy()} style={{ flex: 1 }}>{copied ? t.common.copied : t.order.copyPhrase}</button>
          <button type="button" className="btn btn--primary" onClick={() => setBig(true)} style={{ flex: 1, fontWeight: 600 }}>{t.order.showBig}</button>
        </div>
        <button type="button" className="btn btn--quiet" onClick={onClose}>{t.common.close}</button>
      </div>
    </div>
  );
};
