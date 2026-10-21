/** 최근 스캔·전체 기록 목록의 한 줄. 왼쪽 아이콘 + 가게명(없으면 첫 메뉴) + 메뉴 수·시각, 오른쪽 지우기 */
import type { Scan } from '../types';
import { PixelIcon } from './PixelIcon';
import { KIND_LABEL, lineSummary } from '../lib/kind';

type Props = { readonly scan: Scan; readonly when: string; readonly onOpen: (scan: Scan) => void; readonly onRemove: (id: string) => void };

export const ScanRow = ({ scan: s, when, onOpen, onRemove }: Props) => (
  <div className="frame frame--flat" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
    <button type="button" onClick={() => onOpen(s)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
      <div style={{ width: 48, height: 48, background: 'var(--paper-dark)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PixelIcon icon={s.kind === 'menu' ? (s.items[0]?.icon ?? 'dish') : 'camera'} size={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="jp" style={{ fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.kind === 'menu' ? (s.shopName ?? (s.items[0]?.name_ja ?? KIND_LABEL.menu)) : (s.notes[0]?.text_ko ?? s.items[0]?.name_ko ?? KIND_LABEL[s.kind])}</div>
        <div className="muted small">{s.kind === 'menu' ? `${s.items.length}개 메뉴` : lineSummary(s.kind, s.notes.length || s.items.length)} · {when}</div>
      </div>
    </button>
    <button type="button" className="btn btn--quiet" onClick={() => onRemove(s.id)} aria-label="이 스캔 지우기" style={{ minHeight: 36, padding: '0 8px' }}>지우기</button>
  </div>
);
