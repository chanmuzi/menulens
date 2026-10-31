import { useMemo } from 'react';
import type { Scan, ScanKind } from '../types';
import { TopBar } from '../components/TopBar';
import { ProgressBlocks } from '../components/ProgressBlocks';
import { PixelIcon } from '../components/PixelIcon';
import { MenuPhoto } from '../components/MenuPhoto';
import { BatchStrip } from '../components/BatchStrip';
import { pickSignTip, pickTip } from '../data/tips';
import { useT, type Dict } from '../i18n';

type Props = { readonly scan: Scan; readonly batch: readonly Scan[]; readonly onSwitch: (id: string) => void; readonly onAdd: ((files: readonly File[]) => void) | undefined; readonly onCancel: () => void; readonly onPeek: () => void; readonly onRetry: () => void };

const EXPECTED_BLOCKS = 8;

/** 3단계(묶어 번역) 문구. 메뉴판은 찾은 개수를, 안내문은 줄 단위 번역임을 알린다 */
const translateStep = (p: Dict['processing'], kind: ScanKind | 'unknown', found: number, lines: number, done: boolean): string => {
  if (kind === 'menu') return found === 0 ? p.translateMenuGrouping : p.translateMenuFound(found);
  if (kind === 'sign') return done ? p.translateSignDone(lines) : p.translateSignBusy;
  if (kind === 'other') return done ? p.translateOtherDone(lines) : p.translateOtherBusy;
  return p.translateUnknown;
};

export const ProcessingScreen = ({ scan, batch, onSwitch, onAdd, onCancel, onPeek, onRetry }: Props) => {
  const t = useT();
  const kind: ScanKind | 'unknown' = scan.kindKnown ? scan.kind : 'unknown';
  // 판정 전(unknown)에도 팁·진행 블록은 메뉴판 기준으로 보여준다(대부분 메뉴판). 아이콘만은 확정된 메뉴판에서만 라멘
  const assumeMenu = kind === 'menu' || kind === 'unknown';
  // 안내문을 읽는 동안 식당 상식은 어울리지 않으니 표기 상식으로 바꾼다. 언어가 바뀌면(t) 그 언어의 팁으로
  const tip = useMemo(() => (assumeMenu ? pickTip(scan.createdAt) : pickSignTip(scan.createdAt)), [scan.createdAt, assumeMenu, t]);
  const found = scan.items.length;
  const reading = scan.status === 'reading';
  const streaming = scan.status === 'streaming';
  const busy = reading || streaming || scan.status === 'preparing';
  const failed = scan.status === 'error';
  const recent = scan.items.slice(-4);
  const wordsRead = scan.words.length;
  const title = t.processing.title[kind];

  return (
    <div className="app">
      <TopBar onBack={onCancel} backLabel={t.processing.cancelHome} center={
        <div className="dot" style={{ fontSize: 16 }}>{failed ? t.processing.failedTitle : title}</div>
      } />
      <BatchStrip scans={batch} currentId={scan.id} onSwitch={onSwitch} onAdd={onAdd} />

      <div className="frame" style={{ boxShadow: '4px 4px 0 var(--ink)', overflow: 'hidden' }}>
        {scan.imageDataUrl ? (
          <MenuPhoto src={scan.imageDataUrl} width={scan.width} height={scan.height} words={scan.words} rotation={scan.rotation} tilt={scan.tilt} maxHeight={300} dim overlay={
            <>
              <Corners />
              {busy && <div className="scanline" aria-hidden="true" />}
              <div style={{ position: 'absolute', left: 14, right: 14, bottom: 14, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                {recent.map((it) => (
                  <div key={it.id} className="pop" style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--paper-2)', border: '2px solid var(--ink)', padding: '4px 8px', fontSize: 12, fontWeight: 600 }}>
                    <span className="dot" style={{ color: 'var(--vermilion)' }}>✓</span>{it.name_ko}
                  </div>
                ))}
              </div>
            </>
          }>
            {scan.words.map((w) => (
              <div key={w.id} className="pop" aria-hidden="true" style={{ position: 'absolute', left: `${w.box[0] / 10}%`, top: `${w.box[1] / 10}%`, width: `${(w.box[2] - w.box[0]) / 10}%`, height: `${(w.box[3] - w.box[1]) / 10}%`, border: '2px solid var(--vermilion)', boxSizing: 'border-box', opacity: 0.8 }} />
            ))}
          </MenuPhoto>
        ) : (
          <div style={{ height: 300, background: 'var(--wood)' }} />
        )}
      </div>

      {/* 안내문은 항목이 흐르지 않고 끝에 줄 목록이 한 번에 오므로 개수 대신 진행 중임만 보여준다 */}
      <ProgressBlocks filled={assumeMenu ? found : 0} total={EXPECTED_BLOCKS} active={busy} label={assumeMenu ? t.processing.progressMenuAria(found) : t.processing.progressTranslating} />

      <div className="frame frame--double" style={{ display: 'flex', gap: 14, padding: '16px 16px 16px 14px' }}>
        <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }} aria-hidden="true">
          {/* assumeMenu 와 달리 확정된 메뉴판만 라멘 + 김. 판정 전에는 로고(camera) */}
          <PixelIcon icon={kind === 'menu' ? 'ramen' : 'camera'} size={4} />
          {!failed && kind === 'menu' && <>
            <div className="steam" style={{ left: 22, top: -2 }} />
            <div className="steam" style={{ left: 32, top: -6, animationDelay: '.5s' }} />
            <div className="steam" style={{ left: 42, top: -2, animationDelay: '1s' }} />
          </>}
        </div>
        <div className="dot" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.3, flex: 1 }} aria-live="polite">
          <Step done={scan.status !== 'preparing'} active={scan.status === 'preparing'}>{scan.status === 'preparing' ? t.processing.prepareBusy : t.processing.prepareDone}</Step>
          {failed ? (
            <Step active fail>{scan.error ?? t.processing.unknownError}</Step>
          ) : (
            <>
              <Step active={reading} done={!reading && scan.status !== 'preparing'} todo={scan.status === 'preparing'}>
                {reading ? t.processing.ocrBusy : wordsRead > 0 ? t.processing.ocrDone(wordsRead) : t.processing.ocrSkipped}
                {reading && <span className="blink">▌</span>}
              </Step>
              <Step active={streaming} done={scan.status === 'done'} todo={!streaming && scan.status !== 'done'}>
                {translateStep(t.processing, kind, found, scan.notes.length, scan.status === 'done')}
                {streaming && <span className="blink">▌</span>}
              </Step>
            </>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--paper-dark)', border: '2px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="dot" style={{ fontSize: 12, color: 'var(--vermilion)' }}>{t.processing.tipHeading}</div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: '#3E352D' }}>{tip}</p>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center' }}>
        {failed ? (
          <button type="button" className="btn btn--primary" onClick={onRetry}>{t.common.retry}</button>
        ) : found > 0 ? (
          <button type="button" className="btn btn--quiet" onClick={onPeek}>{t.processing.peek} <span className="dot" style={{ color: 'var(--vermilion)' }}>▶</span></button>
        ) : null}
      </div>
    </div>
  );
};

const Corners = () => (
  <>
    {[
      { left: 10, top: 10, borderLeftWidth: 4, borderTopWidth: 4 },
      { right: 10, top: 10, borderRightWidth: 4, borderTopWidth: 4 },
      { left: 10, bottom: 10, borderLeftWidth: 4, borderBottomWidth: 4 },
      { right: 10, bottom: 10, borderRightWidth: 4, borderBottomWidth: 4 },
    ].map((s, i) => <div key={i} aria-hidden="true" style={{ position: 'absolute', width: 20, height: 20, border: '0 solid var(--vermilion)', zIndex: 2, ...s }} />)}
  </>
);

type StepProps = { readonly done?: boolean; readonly active?: boolean; readonly todo?: boolean; readonly fail?: boolean; readonly children: React.ReactNode };
const Step = ({ done, active, todo, fail, children }: StepProps) => {
  const color = fail ? 'var(--vermilion)' : active ? 'var(--ink)' : todo ? '#B8AC9B' : 'var(--muted)';
  const mark = fail ? '✕' : done ? '✓' : active ? '▶' : '·';
  return (
    <div style={{ display: 'flex', gap: 8, color }}>
      <span style={{ color: active || fail ? 'var(--vermilion)' : undefined }}>{mark}</span>
      <span>{children}</span>
    </div>
  );
};
