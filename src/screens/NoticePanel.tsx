/**
 * 안내문 사진 아래 정리 영역: 요약 / 번역문 / 원문.
 * 요약은 사진에 적힌 내용만, 사진에 없는 일반 상식은 「참고」 상자로 따로 보여 규칙과 헷갈리지 않게 한다.
 * 덮개와 번역문 줄은 같은 선택을 공유한다: 한쪽을 누르면 다른 쪽이 강조되고, 다시 누르면 해제된다.
 * 사진(덮개·번호)에서 고르면 페이지를 그 줄까지 내리고 테두리를 깜빡여 「이 글이 이 뜻」임을 바로 보이게 한다(2026-11-09 피드백).
 */
import { useEffect, useRef, useState } from 'react';
import type { Currency, Rate, Scan } from '../types';
import { Segmented } from '../components/Segmented';
import { formatConverted, splitMoney } from '../lib/money';
import { useT } from '../i18n';

type Tab = 'sum' | 'ko' | 'ja';
type Props = {
  readonly scan: Scan;
  readonly rate: Rate | null;
  readonly selected: number | null;
  readonly onSelect: (i: number) => void;
  /** 번호 배지로만 찍힌 문단의 번호 (note 순번 → 번호) */
  readonly badges: ReadonlyMap<number, number>;
};

/** 요약 속 금액 옆에 다른 통화 환산을 흐리게 붙인다(모델이 아니라 앱 환율로) */
const WithConverted = ({ text, currency, rate }: { text: string; currency: Currency; rate: Rate | null }) => (
  <>{splitMoney(text, currency).map((p, i) => {
    const conv = p.amount === null ? null : formatConverted(p.amount, currency, rate);
    return <span key={i}>{p.text}{conv && <span className="muted small"> ({conv})</span>}</span>;
  })}</>
);

export const NoticePanel = ({ scan, rate, selected, onSelect, badges }: Props) => {
  const t = useT();
  const pending = scan.status !== 'done' && scan.status !== 'error';
  const hasSummary = scan.summary !== null || pending;
  const [tab, setTab] = useState<Tab>(hasSummary ? 'sum' : 'ko');
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  /** 이번 선택이 이 목록의 줄을 눌러 생긴 것인가(그때는 이미 보고 있으니 페이지를 옮기지 않는다) */
  const fromList = useRef(false);
  /** 사진에서 골라 도착한 줄(깜빡임 대상). 같은 줄을 다시 골라도 깜빡이게 횟수를 함께 든다 */
  const [flash, setFlash] = useState<{ readonly i: number; readonly n: number } | null>(null);
  // 사진의 덮개를 누르면 번역문으로 넘어가 그 문단이 보이게 한다: 목록 안에서 스크롤하고, 사진에서 골랐으면 페이지도 그 줄까지 내린다
  useEffect(() => {
    // 목록에서 같은 줄을 다시 눌러 해제한 경우에도 표시를 지운다(다음 사진 선택이 목록 선택으로 오인되지 않게)
    const local = fromList.current;
    fromList.current = false;
    // 깜빡임은 사진에서 골라 도착한 순간에만. 해제하거나 목록에서 고르면 지난 표시를 지운다(다시 깜빡이며 포커스를 잃지 않게)
    if (selected === null || local) setFlash(null);
    if (selected === null) return;
    setTab('ko');
    // 탭이 바뀐 뒤 그려진 줄을 찾도록 두 프레임 기다린다
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const box = listRef.current, row = box?.querySelector<HTMLElement>(`[data-i="${selected}"]`);
      if (!box || !row) return;
      if (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = row.offsetTop - box.clientHeight / 3;
      if (local) return;
      const r = row.getBoundingClientRect();
      // 화면 위에서 1/3 쯤에 오게(아래 말풍선 버튼에 가리지 않게). 이미 다 보이면 그대로
      if (r.top < 0 || r.bottom > window.innerHeight * 0.8) {
        const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: window.scrollY + r.top - window.innerHeight / 3, behavior: smooth ? 'smooth' : 'auto' });
      }
      setFlash((f) => ({ i: selected, n: (f?.n ?? 0) + 1 }));
    }));
  }, [selected]);
  const current: Tab = tab === 'sum' && !hasSummary ? 'ko' : tab;
  const allJa = scan.notes.map((n) => n.text).join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(allJa); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 불가: 길게 눌러 선택 */ } };
  const options = [...(hasSummary ? [{ value: 'sum' as const, label: t.result.tabSummary }] : []), { value: 'ko' as const, label: t.result.tabTranslation }, { value: 'ja' as const, label: t.result.tabOriginal }];

  return (
    <section aria-label={t.result.noticeSectionAria} className="frame frame--flat" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8, borderBottom: '2px solid var(--ink)', display: 'flex' }}>
        <div className="notice-tabs" style={{ flex: 1 }}><Segmented label={t.result.noticeTabsLabel} size="small" value={current} onChange={setTab} options={options} /></div>
      </div>
      <div ref={listRef} style={{ position: 'relative', padding: '12px 14px', maxHeight: '46vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15, lineHeight: 1.65 }}>
        {current === 'sum' && (scan.summary
          ? <>
              <p style={{ margin: 0 }}><WithConverted text={scan.summary.text} currency={scan.currency} rate={rate} /></p>
              {scan.summary.tips.length > 0 && (
                <div style={{ border: '2px dashed var(--muted)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div className="dot small" style={{ color: 'var(--muted)' }}>{t.result.tipsHeading}</div>
                  {scan.summary.tips.map((t, i) => <p key={i} className="muted" style={{ margin: 0, fontSize: 14 }}>{t}</p>)}
                </div>
              )}
            </>
          : <p className="muted" style={{ margin: 0 }}>{t.result.writingSummary}<span className="blink">▌</span></p>)}
        {current === 'ko' && scan.notes.map((n, i) => {
          const badge = badges.get(i);
          const on = selected === i;
          return (
            <button key={flash?.i === i && on ? `${i}-${flash.n}` : i} type="button" data-i={i} aria-pressed={on} className={flash?.i === i && on ? 'flash' : undefined} onClick={() => { fromList.current = true; onSelect(i); }}
              style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline', padding: '2px 4px', margin: '0 -4px',
                background: on ? 'color-mix(in srgb, var(--vermilion) 14%, transparent)' : 'transparent', fontWeight: n.role === 'title' ? 700 : 400 }}>
              {badge !== undefined && <span className="dot" style={{ flexShrink: 0, minWidth: 20, height: 20, padding: '0 4px', background: on ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper-2)', fontSize: 11, lineHeight: '20px', textAlign: 'center' }}>{badge}</span>}
              <span style={{ minWidth: 0 }}>
                {n.tr}
                {n.role === 'label' && <span className="muted small"> {n.text}</span>}
              </span>
            </button>
          );
        })}
        {current === 'ja' && <>
          <p lang={scan.lang.src} style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: scan.lang.src === 'ja' ? 'var(--font-jp)' : undefined, fontSize: 15 }}>{allJa}</p>
          <button type="button" className="btn" onClick={() => void copy()} style={{ alignSelf: 'flex-start', minHeight: 36 }}>{copied ? t.common.copied : t.result.copyOriginal}</button>
        </>}
      </div>
    </section>
  );
};
