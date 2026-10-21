import { useMemo } from 'react';
import type { Scan, ScanKind } from '../types';
import { TopBar } from '../components/TopBar';
import { ProgressBlocks } from '../components/ProgressBlocks';
import { PixelIcon } from '../components/PixelIcon';
import { MenuPhoto } from '../components/MenuPhoto';
import { BatchStrip } from '../components/BatchStrip';
import { pickSignTip, pickTip } from '../data/tips';

type Props = { readonly scan: Scan; readonly batch: readonly Scan[]; readonly onSwitch: (id: string) => void; readonly onAdd: ((files: readonly File[]) => void) | undefined; readonly onCancel: () => void; readonly onPeek: () => void; readonly onRetry: () => void };

const EXPECTED_BLOCKS = 8;

/** 종류 판정 전(unknown)·후의 상단 제목. 판정 전에는 메뉴판·안내문 어느 쪽도 전제하지 않는다 */
const TITLE: Readonly<Record<ScanKind | 'unknown', string>> = { unknown: '읽는 중', menu: '메뉴판 읽는 중', sign: '안내문 읽는 중', other: '글자 읽는 중' };

/** 3단계(묶어 번역) 문구. 메뉴판은 찾은 개수를, 안내문은 줄 단위 번역임을 알린다 */
const translateStep = (kind: ScanKind | 'unknown', found: number, lines: number, done: boolean): string => {
  if (kind === 'menu') return found === 0 ? '메뉴로 묶어 번역하는 중' : `메뉴 ${found}개 찾았어요`;
  if (kind === 'sign') return done ? `안내문 ${lines}줄 번역했어요` : '안내문이에요 · 줄마다 번역하는 중';
  if (kind === 'other') return done ? `${lines}줄 번역했어요` : '사진 속 글자예요 · 번역하는 중';
  return '무슨 글인지 보고 묶는 중';
};

export const ProcessingScreen = ({ scan, batch, onSwitch, onAdd, onCancel, onPeek, onRetry }: Props) => {
  const kind: ScanKind | 'unknown' = scan.kindKnown ? scan.kind : 'unknown';
  // 판정 전(unknown)에도 팁·진행 블록은 메뉴판 기준으로 보여준다(대부분 메뉴판). 아이콘만은 확정된 메뉴판에서만 라멘
  const assumeMenu = kind === 'menu' || kind === 'unknown';
  // 안내문을 읽는 동안 이자카야 상식은 어울리지 않으니 표기 상식으로 바꾼다
  const tip = useMemo(() => (assumeMenu ? pickTip(scan.createdAt) : pickSignTip(scan.createdAt)), [scan.createdAt, assumeMenu]);
  const found = scan.items.length;
  const reading = scan.status === 'reading';
  const streaming = scan.status === 'streaming';
  const busy = reading || streaming || scan.status === 'preparing';
  const failed = scan.status === 'error';
  const recent = scan.items.slice(-4);
  const wordsRead = scan.words.length;
  const title = TITLE[kind];

  return (
    <div className="app">
      <TopBar onBack={onCancel} backLabel="취소하고 홈으로" center={
        <div className="dot" style={{ fontSize: 16 }}>{failed ? '읽지 못했어요' : title}</div>
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
      <ProgressBlocks filled={assumeMenu ? found : 0} total={EXPECTED_BLOCKS} active={busy} label={assumeMenu ? `메뉴 ${found}개 찾음` : '번역하는 중'} />

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
                {translateStep(kind, found, scan.notes.length, scan.status === 'done')}
                {streaming && <span className="blink">▌</span>}
              </Step>
            </>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--paper-dark)', border: '2px solid var(--ink)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="dot" style={{ fontSize: 12, color: 'var(--vermilion)' }}>기다리는 동안 한 가지</div>
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
