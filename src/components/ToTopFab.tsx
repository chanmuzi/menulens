/**
 * 결과 화면의 「맨 위로」 버튼. 메뉴가 많은 메뉴판은 카드나 사진 아래를 한참 내려가야 해서, 사진(맨 위)으로 한 번에 돌아오게 한다(2026-11-09 피드백).
 * 말풍선 버튼 바로 위, 같은 오른쪽 줄에 작게 둔다. 한 화면쯤 내려갔을 때만 보인다.
 */
import { useEffect, useState } from 'react';
import { FAB_SIZE, fabBottom } from './ChatFab';
import { useT } from '../i18n';

export const TO_TOP_SIZE = 44;
/** 말풍선 버튼과의 간격(px) */
const GAP = 12;
/** 말풍선 위에 이 버튼이 차지하는 높이(간격 포함). 결과 화면 아래 여백에 더한다 */
export const TO_TOP_SPACE = TO_TOP_SIZE + GAP;
/** 이만큼(화면 높이 비율) 내려가면 보인다 */
const SHOW_AFTER = 0.6;

type Props = { /** 주문서 바 높이(px). 없으면 0 */ readonly barHeight: number };

export const ToTopFab = ({ barHeight }: Props) => {
  const t = useT();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * SHOW_AFTER);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  if (!shown) return null;
  const toTop = () => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  };
  return (
    <button type="button" aria-label={t.result.toTop} title={t.result.toTop} onClick={toTop}
      // 말풍선 버튼(56px)과 가운데를 맞춰 같은 세로줄에 둔다
      style={{ position: 'fixed', right: `calc(max(14px, calc((100vw - 480px) / 2 + 14px)) + ${(FAB_SIZE - TO_TOP_SIZE) / 2}px)`, bottom: `calc(${fabBottom(barHeight) + FAB_SIZE + GAP}px + var(--safe-bottom))`, zIndex: 22,
        width: TO_TOP_SIZE, height: TO_TOP_SIZE, padding: 0, background: 'var(--paper-2)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)' }}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" shapeRendering="crispEdges" aria-hidden="true"><path d="M4 3h12M10 17V7M5 12l5-5 5 5" /></svg>
    </button>
  );
};
