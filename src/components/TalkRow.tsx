/** 대화 기록 한 줄. 스캔 기록 줄(ScanRow)과 같은 모양: 왼쪽 말풍선 도트 글리프 + 제목 + 「대화 · 시각」, 오른쪽 연필·휴지통 */
import type { Talk } from '../types';
import { DotGlyph } from './DotGlyph';
import { talkTitle } from '../lib/talk';
import { useT } from '../i18n';

type Props = { readonly talk: Talk; readonly when: string; readonly onOpen: (t: Talk) => void; readonly onRename: (t: Talk) => void; readonly onRemove: (t: Talk) => void };

const THUMB = 56;
const glyphBtn = { width: 24, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'none', border: 0, padding: 0, cursor: 'pointer' } as const;

export const TalkRow = ({ talk, when, onOpen, onRename, onRemove }: Props) => {
  const t = useT();
  const title = talkTitle(talk);
  return (
    <div className="frame frame--flat" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6 }}>
      <button type="button" onClick={() => onOpen(talk)} aria-label={t.history.row.openAria(title)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0, color: 'inherit' }}>
        <div style={{ width: THUMB, height: THUMB, background: 'var(--paper-dark)', border: '1.5px solid var(--ink)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DotGlyph name="talk" size={30} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          <div className="muted small">{t.history.row.talkKind} · {when}</div>
        </div>
      </button>
      <button type="button" onClick={() => onRename(talk)} aria-label={t.history.row.renameAria(title)} title={t.history.row.rename} style={glyphBtn}><DotGlyph name="pencil" /></button>
      <button type="button" onClick={() => onRemove(talk)} aria-label={t.history.row.removeAria(title)} title={t.common.remove} style={glyphBtn}><DotGlyph name="trash" /></button>
    </div>
  );
};
