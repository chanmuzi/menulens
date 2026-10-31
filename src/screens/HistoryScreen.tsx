/** 전체 기록. 사진(스캔)·대화 탭으로 나누고, 날짜별로 묶어 보여준다. 개별·전체 삭제(대화는 개별만)와 보관 정책 안내를 둔다. */
import { useState } from 'react';
import type { Scan, Talk } from '../types';
import { TalkRow } from '../components/TalkRow';
import { Segmented } from '../components/Segmented';
import type { HomeTab } from '../lib/storage';
import { TopBar } from '../components/TopBar';
import { ScanRow } from '../components/ScanRow';
import { InstallHint } from '../components/InstallHint';
import type { InstallHint as Hint } from '../lib/platform';
import { dayHead, timeLabel, type DayHead } from '../lib/when';
import { groupScans, type ScanGroup } from '../lib/history';
import { useT } from '../i18n';

type Props = {
  readonly scans: readonly Scan[];
  readonly installHint: Hint;
  readonly onBack: () => void;
  readonly onOpen: (group: ScanGroup) => void;
  readonly onRename: (group: ScanGroup) => void;
  readonly onRemove: (group: ScanGroup) => void;
  readonly onClear: () => void;
  readonly tab: HomeTab;
  readonly onTab: (tab: HomeTab) => void;
  readonly talks: readonly Talk[];
  readonly onOpenTalk: (talk: Talk) => void;
  readonly onRenameTalk: (talk: Talk) => void;
  readonly onRemoveTalk: (talk: Talk) => void;
};

type Day<T> = { readonly head: DayHead; readonly groups: readonly T[] };

/** 최신순 목록을 날짜 라벨별로 묶는다 (순서 유지). 스캔 묶음·대화 공용 */
const groupByDay = <T,>(list: readonly T[], at: (x: T) => number): readonly Day<T>[] =>
  list.reduce<readonly Day<T>[]>((acc, g) => {
    const head = dayHead(at(g));
    const last = acc[acc.length - 1];
    return last && last.head.key === head.key ? [...acc.slice(0, -1), { head, groups: [...last.groups, g] }] : [...acc, { head, groups: [g] }];
  }, []);

/** 날짜 머리말: 날짜는 도트 글꼴, 요일은 본문 글꼴로 바짝 붙이고(도트 글꼴의 괄호·공백은 넓어 벌어져 보인다) 오늘·어제는 채운 배지 */
const DayHeader = ({ head }: { readonly head: DayHead }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, lineHeight: 1 }}>
    <span><span className="dot" style={{ fontSize: 14 }}>{head.date}</span><span style={{ fontSize: 13, fontWeight: 600, marginLeft: 3 }}>({head.weekday})</span></span>
    {head.badge && <span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 8px', fontSize: 11, fontWeight: 600, letterSpacing: '.02em', background: head.isToday ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper-2)' }}>{head.badge}</span>}
  </div>
);

export const HistoryScreen = ({ scans, installHint, onBack, onOpen, onRename, onRemove, onClear, tab, onTab, talks, onOpenTalk, onRenameTalk, onRemoveTalk }: Props) => {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const all = groupScans(scans);
  const days = groupByDay(all, (g) => g.at);
  const talkDays = groupByDay(talks, (t) => t.updatedAt);

  return (
    <div className="app">
      <TopBar onBack={onBack} backLabel={t.common.home} center={
        <div style={{ textAlign: 'center' }}>
          <div className="dot" style={{ fontSize: 16 }}>{t.history.title}</div>
          <div className="dot muted" style={{ fontSize: 11 }}>{t.history.count(tab === 'menu' ? all.length : talks.length)}</div>
        </div>
      } />

      <div className="notice-tabs">
        <Segmented label={t.history.tabsAria} value={tab} onChange={onTab} options={[{ value: 'menu', label: t.history.tabPhotos, icon: 'camera' }, { value: 'talk', label: t.history.tabTalks, icon: 'talk' }]} />
      </div>

      {tab === 'talk' ? (
        talks.length === 0
          ? <p className="muted" style={{ textAlign: 'center', margin: '40px 0', fontSize: 14 }}>{t.history.noTalks}</p>
          : talkDays.map((d) => (
            <section key={d.head.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DayHeader head={d.head} />
              {d.groups.map((t) => <TalkRow key={t.id} talk={t} when={timeLabel(t.updatedAt)} onOpen={onOpenTalk} onRename={onRenameTalk} onRemove={onRemoveTalk} />)}
            </section>
          ))
      ) : scans.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', margin: '40px 0', fontSize: 14 }}>{t.history.noScans}</p>
      ) : days.map((d) => (
        <section key={d.head.key} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DayHeader head={d.head} />
          {d.groups.map((g) => <ScanRow key={g.key} group={g} when={timeLabel(g.at)} onOpen={onOpen} onRename={onRename} onRemove={onRemove} />)}
        </section>
      ))}

      {tab === 'menu' && scans.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
          {confirming ? (
            <>
              <span style={{ fontSize: 13, alignSelf: 'center' }}>{t.history.clearAllConfirm(all.length)}</span>
              <button type="button" className="btn btn--primary" onClick={() => { setConfirming(false); onClear(); }} style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}>{t.common.remove}</button>
              <button type="button" className="btn" onClick={() => setConfirming(false)} style={{ minHeight: 36, padding: '0 12px', fontSize: 13 }}>{t.common.cancel}</button>
            </>
          ) : (
            <button type="button" className="btn btn--quiet" onClick={() => setConfirming(true)}>{t.history.clearAll}</button>
          )}
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <InstallHint hint={installHint} />
        <p className="muted small" style={{ margin: 0, lineHeight: 1.6 }}>
          {t.history.retentionNote}
        </p>
      </div>
    </div>
  );
};
