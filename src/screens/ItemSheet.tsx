import { useEffect } from 'react';
import type { ImageMode, MenuItem, Rate } from '../types';
import { formatKrw, formatPrice, payableJpy } from '../lib/money';
import { ItemImage } from '../components/ItemImage';
import { QtyStepper } from '../components/QtyStepper';
import { PixelIcon } from '../components/PixelIcon';
import { useT, tagLabel } from '../i18n';

type Props = { readonly item: MenuItem; readonly rate: Rate | null; readonly mode: ImageMode; readonly onClose: () => void; /** null 이면 주문 기능 없음(안내문) */ readonly qty?: number | null; readonly onQty?: (qty: number) => void; /** 설명이 아직 올 수 있는가(스캔 진행 중). 기록에서 연 미완 스캔은 false 라 깜빡이지 않는다 */ readonly pending?: boolean; /** 이 항목을 맥락으로 챗 열기 */ readonly onAsk?: () => void };

/** 메뉴 하나의 상세 바텀시트. 주문할 때 보여줄 일본어 문구와 한글 발음을 함께 보여준다. */
export const ItemSheet = ({ item, rate, mode, onClose, qty = null, onQty, pending = false, onAsk }: Props) => {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pron = item.pron || item.tr.replace(/\s*[(（].*?[)）]\s*$/, '');

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sheet-title" style={{ position: 'fixed', inset: 0, zIndex: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button type="button" aria-label={t.common.close} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: 'var(--paper-2)', borderTop: '3px solid var(--ink)', padding: '12px 20px calc(20px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div aria-hidden="true" style={{ width: 40, height: 4, background: 'var(--paper-dark)', alignSelf: 'center' }} />
        <div style={{ display: 'flex', gap: 14 }}>
          <ItemImage item={item} mode={mode} size={92} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div id="sheet-title" className="jp" style={{ fontSize: 20, lineHeight: 1.2 }}>{item.name}</div>
            {item.pron && <div className="dot muted" style={{ fontSize: 12 }}>{item.pron}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{item.tr}</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {(payableJpy(item) !== null || item.category !== '기타') && <span className="dot" style={{ fontSize: 18, color: 'var(--vermilion)', whiteSpace: 'nowrap' }}>{formatPrice(item)}</span>}
                {formatKrw(payableJpy(item), rate) && <span className="muted" style={{ fontSize: 11 }}>{formatKrw(payableJpy(item), rate)}{item.price_tax !== null ? ` ${t.result.taxIncluded}` : ''}</span>}
              </span>
            </div>
            {item.desc
              ? <p style={{ margin: 0, fontSize: 13, color: 'var(--body)', lineHeight: 1.5 }}>{item.desc}</p>
              : pending && !item.detailed && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t.result.writingDesc}<span className="blink">▌</span></p>}
          </div>
        </div>
        {item.tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{item.tags.map((tag) => <span key={tag} className="chip">{tagLabel(t, tag)}</span>)}</div>}
        {qty !== null && onQty && item.category !== '기타' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{t.result.addToOrder}</span>
            <QtyStepper qty={qty} onChange={onQty} label={item.tr} />
          </div>
        )}
        {item.category !== '기타' && <div style={{ background: 'var(--paper-dark)', border: '2px solid var(--ink)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="dot small" style={{ color: 'var(--vermilion)' }}>{t.result.showWhenOrdering}</span>
          <span className="jp" style={{ fontSize: 18 }}>{item.name}を ひとつ ください。</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{pron}오 히토츠 쿠다사이</span>
          <span className="muted small">「{item.tr} 하나 주세요」</span>
        </div>}
        {onAsk && <button type="button" className="btn" onClick={onAsk} style={{ gap: 6 }}><PixelIcon icon="bubble" size={1} />{t.result.ask}</button>}
        <button type="button" className="btn" onClick={onClose}>{t.common.close}</button>
      </div>
    </div>
  );
};
