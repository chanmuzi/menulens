/** 우측 하단 말풍선 버튼. 카드·오버레이 어느 보기에서든 같은 자리. 주문서 바가 있으면 바의 실제 높이 위로 올라간다. 팝업이 열리면 버튼은 숨기고 닫기는 팝업 안에서 */
import { PixelIcon } from './PixelIcon';

export const FAB_SIZE = 56;
/** 주문서 바와 버튼 사이 간격(px) */
const GAP = 12;
/**
 * 버튼 아래 여백(px). barHeight 는 OrderBar 가 잰 바 높이(바 아래 여백 포함, 안전 영역 제외)로 0 이면 바가 없다.
 * 상수(84px)로 가정하던 때는 글꼴 행간이 조금만 달라도(Safari 의 line-height: normal) 바와 겹쳤다
 */
export const fabBottom = (barHeight: number): number => (barHeight > 0 ? barHeight + GAP : 16);

type Props = { readonly title: string; readonly unread: number; /** 주문서 바 높이(px). 없으면 0 */ readonly barHeight: number; readonly onClick: () => void; readonly buttonRef?: React.Ref<HTMLButtonElement> };

export const ChatFab = ({ title, unread, barHeight, onClick, buttonRef }: Props) => (
  <button ref={buttonRef} type="button" aria-label={`${title}${unread > 0 ? `, 새 답 ${unread}개` : ''}`} onClick={onClick}
    style={{ position: 'fixed', right: 'max(14px, calc((100vw - 480px) / 2 + 14px))', bottom: `calc(${fabBottom(barHeight)}px + var(--safe-bottom))`, zIndex: 22, width: FAB_SIZE, height: FAB_SIZE, padding: 0,
      background: 'var(--paper-2)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <PixelIcon icon="bubble" size={2} />
    {unread > 0 && (
      <span className="dot" aria-hidden="true" style={{ position: 'absolute', top: -8, right: -8, minWidth: 18, height: 18, padding: '0 4px', background: 'var(--vermilion)', color: 'var(--paper-2)', border: '2px solid var(--ink)', fontSize: 10, lineHeight: '14px' }}>{unread}</span>
    )}
  </button>
);
