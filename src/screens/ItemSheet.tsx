import { useEffect } from 'react';
import type { Currency, ImageMode, MenuItem, Rate, ScanLang } from '../types';
import { formatConverted, formatPrice, payable } from '../lib/money';
import { buildOneOrderText } from '../lib/order';
import { ItemImage } from '../components/ItemImage';
import { QtyStepper } from '../components/QtyStepper';
import { PixelIcon } from '../components/PixelIcon';
import { useT, tagLabel } from '../i18n';

type Props = { readonly item: MenuItem; readonly rate: Rate | null; readonly currency: Currency; /** 사진의 방향(원문·앱 언어). 원문이 일본어면 세리프 글꼴, 주문 문구의 언어와 발음도 이것으로 */ readonly lang: ScanLang; readonly mode: ImageMode; readonly onClose: () => void; /** null 이면 주문 기능 없음(안내문) */ readonly qty?: number | null; readonly onQty?: (qty: number) => void; /** 설명이 아직 올 수 있는가(스캔 진행 중). 기록에서 연 미완 스캔은 false 라 깜빡이지 않는다 */ readonly pending?: boolean; /** 이 항목을 맥락으로 챗 열기 */ readonly onAsk?: () => void };

/** 메뉴 하나의 상세 바텀시트. 주문할 때 보여줄 원문 문구와 발음을 함께 보여준다(order.ts 규칙). */
export const ItemSheet = ({ item, rate, currency, lang, mode, onClose, qty = null, onQty, pending = false, onAsk }: Props) => {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const srcLang = lang.src;
  const one = item.category !== '기타' ? buildOneOrderText(item, lang) : null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sheet-title" style={{ position: 'fixed', inset: 0, zIndex: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button type="button" aria-label={t.common.close} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: 'var(--paper-2)', borderTop: '3px solid var(--ink)', padding: '12px 20px calc(20px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div aria-hidden="true" style={{ width: 40, height: 4, background: 'var(--paper-dark)', alignSelf: 'center' }} />
        <div style={{ display: 'flex', gap: 14 }}>
          <ItemImage item={item} mode={mode} size={92} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div id="sheet-title" lang={srcLang} className={srcLang === 'ja' ? 'jp' : undefined} style={{ fontSize: 20, lineHeight: 1.2, fontWeight: srcLang === 'ja' ? undefined : 700 }}>{item.name}</div>
            {item.pron && <div className="dot muted" style={{ fontSize: 12 }}>{item.pron}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{item.tr}</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {(payable(item) !== null || item.category !== '기타') && <span className="dot" style={{ fontSize: 18, color: 'var(--vermilion)', whiteSpace: 'nowrap' }}>{formatPrice(item, currency)}</span>}
                {formatConverted(payable(item), currency, rate) && <span className="muted" style={{ fontSize: 11 }}>{formatConverted(payable(item), currency, rate)}{item.price_tax !== null ? ` ${t.result.taxIncluded}` : ''}</span>}
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
        {one && <div style={{ background: 'var(--paper-dark)', border: '2px solid var(--ink)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="dot small" style={{ color: 'var(--vermilion)' }}>{t.result.showWhenOrdering}</span>
          <span lang={srcLang} className={srcLang === 'ja' ? 'jp' : undefined} style={{ fontSize: 18, fontWeight: srcLang === 'ja' ? undefined : 600 }}>{one.src}</span>
          {one.pron && <span style={{ fontSize: 13, fontWeight: 500 }}>{one.pron}</span>}
          {lang.src !== lang.dst && <span className="muted small">{one.tr}</span>}
        </div>}
        {onAsk && <button type="button" className="btn" onClick={onAsk} style={{ gap: 6 }}><PixelIcon icon="bubble" size={1} />{t.result.ask}</button>}
        <button type="button" className="btn" onClick={onClose}>{t.common.close}</button>
      </div>
    </div>
  );
};
