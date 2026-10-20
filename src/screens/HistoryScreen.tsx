/** 전체 기록. 날짜별로 묶어 보여주고, 개별·전체 삭제와 보관 정책 안내를 둔다. */
import { useState } from 'react';
import type { Scan } from '../types';
import { TopBar } from '../components/TopBar';
import { ScanRow } from '../components/ScanRow';
import { InstallHint } from '../components/InstallHint';
import type { InstallHint as Hint } from '../lib/platform';
import { dayLabel, timeLabel } from '../lib/when';

type Props = {
  readonly scans: readonly Scan[];
  readonly installHint: Hint;
  readonly onBack: () => void;
  readonly onOpen: (scan: Scan) => void;
  readonly onRemove: (id: string) => void;
  readonly onClear: () => void;
};

type Group = { readonly label: string; readonly scans: readonly Scan[] };

/** 최신순 목록을 날짜 라벨별로 묶는다 (순서 유지) */
const groupByDay = (scans: readonly Scan[]): readonly Group[] =>
  scans.reduce<readonly Group[]>((acc, s) => {
    const label = dayLabel(s.createdAt);
    const last = acc[acc.length - 1];
    return last && last.label === label ? [...acc.slice(0, -1), { label, scans: [...last.scans, s] }] : [...acc, { label, scans: [s] }];
  }, []);

export const HistoryScreen = ({ scans, installHint, onBack, onOpen, onRemove, onClear }: Props) => {
  const [confirming, setConfirming] = useState(false);
  const groups = groupByDay(scans);

  return (
    <div className="app">
      <TopBar onBack={onBack} backLabel="홈으로" center={
        <div style={{ textAlign: 'center' }}>
          <div className="dot" style={{ fontSize: 16 }}>전체 기록</div>
          <div className="dot muted" style={{ fontSize: 11 }}>{scans.length}건</div>
        </div>
      } />

      {scans.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', margin: '40px 0', fontSize: 14 }}>아직 기록이 없어요</p>
      ) : groups.map((g) => (
        <section key={g.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="dot" style={{ fontSize: 14 }}>{g.label}</div>
          {g.scans.map((s) => <ScanRow key={s.id} scan={s} when={timeLabel(s.createdAt)} onOpen={onOpen} onRemove={onRemove} />)}
        </section>
      ))}

      {scans.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          {confirming ? (
            <>
              <span style={{ fontSize: 13, alignSelf: 'center' }}>{scans.length}건을 모두 지울까요?</span>
              <button type="button" className="btn btn--primary" onClick={() => { setConfirming(false); onClear(); }} style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}>지우기</button>
              <button type="button" className="btn" onClick={() => setConfirming(false)} style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}>취소</button>
            </>
          ) : (
            <button type="button" className="btn btn--quiet" onClick={() => setConfirming(true)}>전체 지우기</button>
          )}
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <InstallHint hint={installHint} />
        <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
          기록은 이 기기에만 저장되고 서버에는 남지 않아요. 브라우저 데이터를 지우거나, iPhone 의 Safari 에서 7일 넘게 열지 않으면 사라질 수 있어요.
        </p>
      </div>
    </div>
  );
};
