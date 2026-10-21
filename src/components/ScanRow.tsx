/** 최근 스캔·전체 기록 목록의 한 줄. 한 번에 읽은 여러 장은 한 줄(사진 N장). 왼쪽 아이콘 + 가게명(없으면 첫 메뉴) + 메뉴 수·시각, 오른쪽 지우기 */
import { PixelIcon } from './PixelIcon';
import { groupSummary, groupTitle, type ScanGroup } from '../lib/history';

type Props = { readonly group: ScanGroup; readonly when: string; readonly onOpen: (group: ScanGroup) => void; readonly onRemove: (group: ScanGroup) => void };

export const ScanRow = ({ group: g, when, onOpen, onRemove }: Props) => {
  const first = g.scans[0]!;
  return (
    <div className="frame frame--flat" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
      <button type="button" onClick={() => onOpen(g)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
        <div style={{ position: 'relative', width: 48, height: 48, background: 'var(--paper-dark)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PixelIcon icon={first.kind === 'menu' ? (first.items[0]?.icon ?? 'dish') : 'camera'} size={2} />
          {g.scans.length > 1 && <span className="dot" aria-hidden="true" style={{ position: 'absolute', right: -4, bottom: -4, padding: '1px 4px', background: 'var(--ink)', color: 'var(--paper)', fontSize: 10, lineHeight: '14px' }}>{g.scans.length}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="jp" style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupTitle(g)}</div>
          <div className="muted small">{groupSummary(g)} · {when}</div>
        </div>
      </button>
      <button type="button" className="btn btn--quiet" onClick={() => onRemove(g)} aria-label={g.scans.length > 1 ? `이 묶음 ${g.scans.length}장 지우기` : '이 스캔 지우기'} style={{ minHeight: 36, padding: '0 8px' }}>지우기</button>
    </div>
  );
};
