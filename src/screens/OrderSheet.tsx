/** 주문 문구 시트: 담은 목록·합계, 직원에게 보여줄 일본어(크게), 한글 발음, 뜻. 복사·비우기. */
import { useEffect, useState } from 'react';
import type { Rate } from '../types';
import { formatJpy, formatPrice } from '../lib/money';
import { buildOrderText, totalCount, totalJpy, totalKrw, type OrderLine } from '../lib/order';
import { QtyStepper } from '../components/QtyStepper';

type Props = { readonly lines: readonly OrderLine[]; readonly rate: Rate | null; readonly onQty: (id: string, qty: number) => void; readonly onClear: () => void; readonly onClose: () => void };

export const OrderSheet = ({ lines, rate, onQty, onClear, onClose }: Props) => {
  const [big, setBig] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => { if (lines.length === 0) onClose(); }, [lines.length, onClose]);

  const text = buildOrderText(lines);
  const [jpy, hasUnknown] = totalJpy(lines);
  const krw = totalKrw(jpy, rate);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text.ja); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 클립보드 불가 */ }
  };

  if (big) {
    // 직원에게 보여주는 화면: 일본어만 크게
    return (
      <div role="dialog" aria-modal="true" aria-label="직원에게 보여주기" style={{ position: 'fixed', inset: 0, zIndex: 30, background: 'var(--paper-2)', display: 'flex', flexDirection: 'column', padding: 'calc(16px + var(--safe-top)) 24px calc(16px + var(--safe-bottom))', gap: 16 }}>
        <div className="jp" style={{ flex: 1, fontSize: 30, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflow: 'auto', display: 'flex', alignItems: 'center' }}>{text.ja}</div>
        <button type="button" className="btn" onClick={() => setBig(false)}>돌아가기</button>
      </div>
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="order-title" style={{ position: 'fixed', inset: 0, zIndex: 25, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button type="button" aria-label="닫기" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '88dvh', overflow: 'auto', background: 'var(--paper-2)', borderTop: '3px solid var(--ink)', padding: '12px 20px calc(20px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div aria-hidden="true" style={{ width: 40, height: 4, background: 'var(--paper-dark)', alignSelf: 'center' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div id="order-title" className="dot" style={{ fontSize: 18 }}>주문서 <span className="muted" style={{ fontSize: 13 }}>· {totalCount(lines)}개</span></div>
          <button type="button" className="btn btn--quiet" onClick={onClear} style={{ minHeight: 32, padding: '0 6px' }}>비우기</button>
        </div>

        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {lines.map(({ item, qty }) => (
            <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name_ko}</div>
                <div className="jp muted" style={{ fontSize: 12, fontWeight: 500 }}>{item.name_ja} · {formatPrice(item)}</div>
              </div>
              <QtyStepper qty={qty} onChange={(q) => onQty(item.id, q)} label={item.name_ko} size="small" />
            </li>
          ))}
        </ul>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '2px dashed var(--ink)', paddingTop: 10 }}>
          <span className="dot" style={{ fontSize: 14 }}>합계{hasUnknown ? ' (가격 미표기 제외)' : ''}</span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="dot" style={{ fontSize: 20, color: 'var(--vermilion)' }}>{formatJpy(jpy)}</span>
            {krw !== null && <span className="muted" style={{ fontSize: 12 }}>≈ ₩{krw.toLocaleString('ko-KR')}</span>}
          </span>
        </div>

        <div style={{ background: 'var(--paper-dark)', border: '2px solid var(--ink)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="dot small" style={{ color: 'var(--vermilion)' }}>직원에게 보여주세요</span>
          <p className="jp" style={{ margin: 0, fontSize: 17, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text.ja}</p>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text.pron}</p>
          <p className="muted small" style={{ margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{text.ko}</p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn" onClick={() => void copy()} style={{ flex: 1 }}>{copied ? '복사했어요' : '일본어 복사'}</button>
          <button type="button" className="btn btn--primary" onClick={() => setBig(true)} style={{ flex: 1, fontWeight: 600 }}>크게 보여주기</button>
        </div>
        <button type="button" className="btn btn--quiet" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
};
