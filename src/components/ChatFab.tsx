/** 우측 하단 말풍선 버튼. 카드·오버레이 어느 보기에서든 같은 자리. 주문서 바가 있으면 그 위로 올라간다. */
import { PixelIcon } from './PixelIcon';

export const FAB_SIZE = 56;
/** 버튼 아래 여백(px). 주문서 바가 있으면 그 위로 */
export const fabBottom = (aboveBar: boolean): number => (aboveBar ? 84 : 16);
/** 팝업이 버튼 위에 앉을 때의 아래 여백 */
export const popupBottom = (aboveBar: boolean): number => fabBottom(aboveBar) + FAB_SIZE + 12;

type Props = { readonly open: boolean; readonly unread: number; readonly aboveBar: boolean; readonly onClick: () => void; readonly buttonRef?: React.Ref<HTMLButtonElement> };

export const ChatFab = ({ open, unread, aboveBar, onClick, buttonRef }: Props) => (
  <button ref={buttonRef} type="button" aria-label={open ? '물어보기 닫기' : `메뉴판에 물어보기${unread > 0 ? `, 새 답 ${unread}개` : ''}`} aria-expanded={open} onClick={onClick}
    style={{ position: 'fixed', right: 'max(14px, calc((100vw - 480px) / 2 + 14px))', bottom: `calc(${fabBottom(aboveBar)}px + var(--safe-bottom))`, zIndex: 22, width: FAB_SIZE, height: FAB_SIZE, padding: 0,
      background: open ? 'var(--ink)' : 'var(--paper-2)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {open
      ? <span className="dot" style={{ color: 'var(--paper-2)', fontSize: 20, lineHeight: 1 }}>✕</span>
      : <PixelIcon icon="bubble" size={2} />}
    {!open && unread > 0 && (
      <span className="dot" aria-hidden="true" style={{ position: 'absolute', top: -8, right: -8, minWidth: 18, height: 18, padding: '0 4px', background: 'var(--vermilion)', color: 'var(--paper-2)', border: '2px solid var(--ink)', fontSize: 10, lineHeight: '14px' }}>{unread}</span>
    )}
  </button>
);
