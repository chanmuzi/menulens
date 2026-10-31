/**
 * 안내문 덮개 층 (사진 층 안에 그린다). 문단마다 원문 줄을 사진 배경색으로 지우고 번역을 그 자리에 쓴다.
 * 들어가지 않는 문단은 번호 배지만 찍는다 — 판정은 lib/coverLayout.ts.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { Box } from '../types';
import type { MarkerCtx } from './MenuPhoto';
import { LINE_HEIGHT, PAD_X, planCovers, type Measure, type Rect } from '../lib/coverLayout';
import { rgba, type BoxColors } from '../lib/sample';
import { useT } from '../i18n';

export type CoverBlock = {
  readonly key: string;
  readonly text: string;
  /** 줄 상자들(0~1000). 비어 있으면 bbox 하나를 줄로 본다 */
  readonly lines: readonly Box[];
  readonly title: boolean;
  /** 번호 배지일 때 표시할 글자(사진 아래 목록과 같은 번호). null 이면 점 */
  readonly badgeLabel: (n: number) => string | null;
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly colors?: BoxColors;
};

type Props = { readonly blocks: readonly CoverBlock[]; readonly ctx: MarkerCtx; readonly rotation: number; readonly rot: number; /** 번호 배지가 된 블록 key → 번호 */ readonly onBadges: (badges: ReadonlyMap<string, number>) => void };

const FONT = "'IBM Plex Sans KR', system-ui, sans-serif";
const PAPER: readonly [number, number, number] = [251, 246, 236];

/** 캔버스 measureText 로 글자 폭을 잰다. 같은 글·크기는 다시 재지 않는다 */
const makeMeasure = (): Measure => {
  const g = document.createElement('canvas').getContext('2d');
  const cache = new Map<string, number>();
  return (text, size) => {
    const k = `${size}|${text}`;
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    if (!g) return text.length * size;
    g.font = `600 ${size}px ${FONT}`;
    const w = g.measureText(text).width;
    cache.set(k, w);
    return w;
  };
};

/** 웹 글꼴이 늦게 오면 폭이 달라지므로 준비된 뒤 한 번 더 배치한다 */
const useFontsReady = (): boolean => {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || !document.fonts || document.fonts.status === 'loaded');
  useEffect(() => {
    if (ready || !document.fonts) return;
    let alive = true;
    void document.fonts.ready.then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [ready]);
  return ready;
};

export const NoticeCovers = ({ blocks, ctx, rotation, rot, onBadges }: Props) => {
  const t = useT();
  const fontsReady = useFontsReady();
  const { W, Hi } = ctx;
  const scale = ctx.fit.scale;
  // 90·270 이면 화면 기준 가로·세로가 바뀌므로 x·y 를 바꾼 좌표에서 배치하고 되돌린다
  const swap = rotation === 90 || rotation === 270;
  const toRect = (b: Box): Rect => { const r = { x: (b[0] / 1000) * W, y: (b[1] / 1000) * Hi, w: ((b[2] - b[0]) / 1000) * W, h: ((b[3] - b[1]) / 1000) * Hi }; return swap ? { x: r.y, y: r.x, w: r.h, h: r.w } : r; };
  const back = (r: Rect): Rect => (swap ? { x: r.y, y: r.x, w: r.h, h: r.w } : r);
  const sig = blocks.map((b) => `${b.key}:${b.text}:${b.lines.join(';')}`).join('|');
  const plan = (z: number) => planCovers(blocks.map((b) => ({ text: b.text, lines: b.lines.map(toRect), title: b.title })), scale * z, makeMeasure());
  // 번호는 확대 전(1×) 배치로 정한다 → 사진 아래 목록 번호가 확대해도 바뀌지 않는다
  // eslint-disable-next-line react-hooks/exhaustive-deps -- blocks 는 매 렌더 새 배열이라 내용 문자열로 비교한다
  const basePlans = useMemo(() => plan(1), [sig, W, Hi, scale, swap, fontsReady]);
  // 두 손가락으로 확대하면 그 배율로 다시 배치해, 번호였던 문단도 들어가는 만큼 제자리 덮개로 바뀐다(0.5 단위로만 다시 계산)
  const zStep = Math.max(1, Math.round(ctx.zoom * 2) / 2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plans = useMemo(() => (zStep === 1 ? basePlans : plan(zStep)), [basePlans, zStep]);
  const badges = useMemo(() => {
    let n = 0;
    return new Map(blocks.flatMap((b, i) => (basePlans[i]?.mode === 'badge' ? [[b.key, ++n] as const] : [])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePlans]);
  // 배지 크기: 이웃 배지와의 화면 거리에 맞춰 14~20px (메뉴판 번호 배지와 같은 방식)
  const badgeSize = useMemo(() => {
    const pts = blocks.flatMap((b, i) => (plans[i]?.mode === 'badge' && b.lines[0] ? [{ key: b.key, x: (b.lines[0][0] / 1000) * W * scale * ctx.zoom, y: (((b.lines[0][1] + b.lines[0][3]) / 2) / 1000) * Hi * scale * ctx.zoom }] : []));
    return new Map(pts.map((p) => [p.key, Math.round(Math.max(14, Math.min(20, Math.min(...pts.filter((o) => o !== p).map((o) => Math.hypot(o.x - p.x, o.y - p.y) * 0.85), 20))))] as const));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, W, Hi, scale, ctx.zoom]);
  const badgeSig = [...badges].map(([k, n]) => `${k}=${n}`).join(',');
  useEffect(() => { onBadges(badges); }, [badgeSig]); // eslint-disable-line react-hooks/exhaustive-deps
  // 「표시 끄기」로 덮개 층이 내려가면 사진 아래 번역문의 번호도 지운다
  useEffect(() => () => onBadges(new Map()), [onBadges]);

  const ms = ctx.markerScale;
  const ground: ReactElement[] = [];
  const texts: ReactElement[] = [];
  blocks.forEach((b, i) => {
    const plan = plans[i];
    if (!plan) return;
    if (plan.mode === 'badge') {
      const first = b.lines[0];
      if (!first) return;
      const n = badges.get(b.key);
      const label = (n === undefined ? null : b.badgeLabel(n)) ?? '•';
      const size = badgeSize.get(b.key) ?? 20;
      // 줄 왼쪽 바깥, 세로 가운데에 붙여 원문 글자를 가리지 않는다
      texts.push(
        <button key={b.key} type="button" onClick={b.onClick} aria-pressed={b.selected} aria-label={t.result.coverBadgeAria(label, b.text)} className="dot"
          style={{ position: 'absolute', left: `${first[0] / 10}%`, top: `${(first[1] + first[3]) / 20}%`, transform: `translate(-100%, -50%) rotate(${rot}deg) scale(${ms})`, transformOrigin: 'right center',
            minWidth: size, height: size, padding: '0 3px', cursor: 'pointer', background: b.selected ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper-2)', border: '1.5px solid var(--paper-2)', fontSize: Math.max(9, size * 0.55), lineHeight: 1, zIndex: 3 }}>
          {label}
        </button>,
      );
      return;
    }
    const bg = rgba(b.colors?.bgRgb ?? PAPER, 1);
    // 바탕: 원문 줄마다 + 글자 영역. 모든 바탕을 먼저 깔고 글자를 올려 뒤 문단 바탕이 앞 문단 글자를 덮지 않게 한다
    const grounds = [...b.lines.map((l) => back(toRect(l))), back(plan.rect)];
    grounds.forEach((g, k) => ground.push(
      <div key={`${b.key}-g${k}`} aria-hidden="true" style={{ position: 'absolute', left: g.x - 1.5, top: g.y - 1.5, width: g.w + 3, height: g.h + 3, background: bg, zIndex: 1, pointerEvents: 'none' }} />,
    ));
    const area = back(plan.rect);
    texts.push(
      <div key={b.key} role="button" tabIndex={0} aria-pressed={b.selected} onClick={b.onClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.onClick(); } }}
        style={{ position: 'absolute', left: area.x + area.w / 2, top: area.y + area.h / 2, width: plan.rect.w, height: plan.rect.h, transform: `translate(-50%, -50%) rotate(${rot}deg)`,
          boxSizing: 'border-box', padding: `0 ${PAD_X}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          fontFamily: FONT, fontWeight: 600, fontSize: plan.size, lineHeight: LINE_HEIGHT, color: b.colors?.fg ?? 'var(--ink)', cursor: 'pointer', zIndex: 2,
          outline: b.selected ? `${2 * ms}px solid var(--vermilion)` : 'none', outlineOffset: 1.5 * ms }}>
        {plan.lines.map((l, k) => <span key={k} style={{ whiteSpace: 'nowrap' }}>{l}</span>)}
      </div>,
    );
  });
  return <>{ground}{texts}</>;
};
