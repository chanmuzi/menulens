import { useMemo } from 'react';
import type { Scan } from '../types';
import { TopBar } from '../components/TopBar';
import { ProgressBlocks } from '../components/ProgressBlocks';
import { PixelIcon } from '../components/PixelIcon';
import { MenuPhoto } from '../components/MenuPhoto';
import { pickTip } from '../data/tips';

type Props = { readonly scan: Scan; readonly onCancel: () => void; readonly onPeek: () => void; readonly onRetry: () => void };

const EXPECTED_BLOCKS = 8;

export const ProcessingScreen = ({ scan, onCancel, onPeek, onRetry }: Props) => {
  const tip = useMemo(() => pickTip(scan.createdAt), [scan.createdAt]);
  const found = scan.items.length;
  const reading = scan.status === 'reading';
  const streaming = scan.status === 'streaming';
  const busy = reading || streaming || scan.status === 'preparing';
  const failed = scan.status === 'error';
  const recent = scan.items.slice(-4);
  const wordsRead = scan.words.length;

  return (
    <div className="app">
      <TopBar onBack={onCancel} backLabel="취소하고 홈으로" center={
        <div style={{ textAlign: 'center' }}>
          <div className="dot" style={{ fontSize: 16 }}>{failed ? '읽지 못했어요' : '읽는 중'}</div>
          <div className="dot muted" style={{ fontSize: 10 }}>{failed ? 'えらー' : 'よみこみちゅう'}</div>
        </div>
      } />

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

      <ProgressBlocks filled={found} total={EXPECTED_BLOCKS} active={busy} />

      <div className="frame frame--double" style={{ display: 'flex', gap: 14, padding: '16px 16px 16px 14px' }}>
        <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }} aria-hidden="true">
          <PixelIcon icon="ramen" size={4} />
          {!failed && <>
            <div className="steam" style={{ left: 22, top: -2 }} />
            <div className="steam" style={{ left: 32, top: -6, animationDelay: '.5s' }} />
            <div className="steam" style={{ left: 42, top: -2, animationDelay: '1s' }} />
          </>}
        </div>
        <div className="dot" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.3, flex: 1 }} aria-live="polite">
          <Step done={scan.status !== 'preparing'} active={scan.status === 'preparing'}>사진 정리{scan.status === 'preparing' ? '하는 중' : '했어요'}</Step>
          {failed ? (
            <Step active fail>{scan.error ?? '알 수 없는 오류'}</Step>
          ) : (
            <>
              <Step active={reading} done={!reading && scan.status !== 'preparing'} todo={scan.status === 'preparing'}>
                {reading ? '글자를 찾는 중' : wordsRead > 0 ? `단어 ${wordsRead}개 읽었어요` : '글자 읽기 건너뜀'}
                {reading && <span className="blink">▌</span>}
              </Step>
              <Step active={streaming} done={scan.status === 'done'} todo={!streaming && scan.status !== 'done'}>
                {found === 0 ? '메뉴로 묶어 번역하는 중' : `메뉴 ${found}개 찾았어요`}
                {streaming && <span className="blink">▌</span>}
              </Step>
            </>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--paper-dark)', border: '2px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="dot" style={{ fontSize: 12, color: 'var(--vermilion)' }}>豆知識</span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>기다리는 동안 한 가지</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: '#3E352D' }}>{tip}</p>
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center' }}>
        {failed ? (
          <button type="button" className="btn btn--primary" onClick={onRetry}>다시 시도</button>
        ) : found > 0 ? (
          <button type="button" className="btn btn--quiet" onClick={onPeek}>먼저 찾은 것부터 보기 <span className="dot" style={{ color: 'var(--vermilion)' }}>▶</span></button>
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
