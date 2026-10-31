/** 최근 스캔·전체 기록 목록의 한 줄. 한 번에 읽은 여러 장은 한 줄(썸네일 모서리에 장수). 왼쪽 사진 썸네일 + 제목 + 「종류 · 시각」, 오른쪽 작은 연필(이름 고치기)·휴지통(지우기) */
import { PixelIcon } from './PixelIcon';
import { DotGlyph } from './DotGlyph';
import { groupKind, groupThumb, groupTitle, type ScanGroup } from '../lib/history';
import { useT } from '../i18n';

type Props = { readonly group: ScanGroup; readonly when: string; readonly onOpen: (group: ScanGroup) => void; readonly onRename: (group: ScanGroup) => void; readonly onRemove: (group: ScanGroup) => void };

const THUMB = 56;
/** 아이콘은 작게(12px), 누르는 칸은 줄 높이 안에서 24×28 */
const glyphBtn = { width: 24, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'none', border: 0, padding: 0, cursor: 'pointer' } as const;

export const ScanRow = ({ group: g, when, onOpen, onRename, onRemove }: Props) => {
  const t = useT();
  const first = g.scans[0]!;
  const title = groupTitle(g);
  const thumb = groupThumb(g);
  return (
    <div className="frame frame--flat" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 6px 6px 6px' }}>
      <button type="button" onClick={() => onOpen(g)} aria-label={t.history.row.openAria(title)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0, color: 'inherit' }}>
        <div style={{ position: 'relative', width: THUMB, height: THUMB, background: 'var(--paper-dark)', border: '1.5px solid var(--ink)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {thumb
            ? <img src={thumb} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <PixelIcon icon={first.kind === 'menu' ? (first.items[0]?.icon ?? 'dish') : 'camera'} size={2} />}
          {g.scans.length > 1 && <span className="dot" aria-label={t.history.row.photoCountAria(g.scans.length)} style={{ position: 'absolute', right: 0, bottom: 0, minWidth: 16, padding: '0 4px', background: 'var(--ink)', color: 'var(--paper-2)', fontSize: 11, lineHeight: '16px', textAlign: 'center' }}>{g.scans.length}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div className="muted small">{groupKind(g)} · {when}</div>
        </div>
      </button>
      <button type="button" onClick={() => onRename(g)} aria-label={t.history.row.renameAria(title)} title={t.history.row.rename} style={glyphBtn}><DotGlyph name="pencil" /></button>
      <button type="button" onClick={() => onRemove(g)} aria-label={g.scans.length > 1 ? t.history.row.removeGroupAria(title, g.scans.length) : t.history.row.removeAria(title)} title={t.common.remove} style={glyphBtn}><DotGlyph name="trash" /></button>
    </div>
  );
};
