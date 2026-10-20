import { useEffect } from 'react';
import type { ImageMode, MenuItem, Rate } from '../types';
import { formatJpy, formatKrw } from '../lib/money';
import { ItemImage } from '../components/ItemImage';

type Props = { readonly item: MenuItem; readonly rate: Rate | null; readonly mode: ImageMode; readonly onClose: () => void };

/** 메뉴 하나의 상세 바텀시트. 주문할 때 보여줄 일본어 문구와 한글 발음을 함께 보여준다. */
export const ItemSheet = ({ item, rate, mode, onClose }: Props) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pron = item.pron_ko || item.name_ko.replace(/\s*[(（].*?[)）]\s*$/, '');

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="sheet-title" style={{ position: 'fixed', inset: 0, zIndex: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <button type="button" aria-label="닫기" onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(42,33,27,.45)', border: 0, cursor: 'pointer' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 480, background: 'var(--paper-2)', borderTop: '3px solid var(--ink)', padding: '12px 20px calc(20px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div aria-hidden="true" style={{ width: 40, height: 4, background: 'var(--paper-dark)', alignSelf: 'center' }} />
        <div style={{ display: 'flex', gap: 14 }}>
          <ItemImage item={item} mode={mode} size={92} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div id="sheet-title" className="jp" style={{ fontSize: 20, lineHeight: 1.2 }}>{item.name_ja}</div>
            {item.pron_ko && <div className="dot muted" style={{ fontSize: 12 }}>{item.pron_ko}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{item.name_ko}</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span className="dot" style={{ fontSize: 18, color: 'var(--vermilion)' }}>{formatJpy(item.price_jpy)}</span>
                {formatKrw(item.price_jpy, rate) && <span className="muted" style={{ fontSize: 11 }}>{formatKrw(item.price_jpy, rate)}</span>}
              </span>
            </div>
            {item.desc_ko
              ? <p style={{ margin: 0, fontSize: 13, color: 'var(--body)', lineHeight: 1.5 }}>{item.desc_ko}</p>
              : !item.detailed && <p className="muted" style={{ margin: 0, fontSize: 13 }}>설명 쓰는 중<span className="blink">▌</span></p>}
          </div>
        </div>
        {item.tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{item.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>}
        <div style={{ background: 'var(--paper-dark)', border: '2px solid var(--ink)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="dot small" style={{ color: 'var(--vermilion)' }}>주문할 때 보여주세요</span>
          <span className="jp" style={{ fontSize: 18 }}>{item.name_ja}を ひとつ ください。</span>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{pron}오 히토츠 쿠다사이</span>
          <span className="muted small">「{item.name_ko} 하나 주세요」</span>
        </div>
        <button type="button" className="btn" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
};
