import { useState } from 'react';
import type { MenuItem, Scan } from '../types';
import { formatJpy } from '../lib/money';
import { MenuPhoto, type MarkerCtx } from '../components/MenuPhoto';

type Props = { readonly scan: Scan; readonly selectedId: string | null; readonly onSelect: (item: MenuItem) => void };

/** 메뉴가 이 수를 넘으면 칩 대신 번호 배지를 붙인다 */
const CHIP_LIMIT = 10;
const BADGE_MAX = 26;
const BADGE_MIN = 13;

const shortName = (s: string): string => s.replace(/\s*[(（].*?[)）]\s*$/, '').trim() || s;

/** 각 항목 중심에서 가장 가까운 다른 항목까지의 화면상 거리(px) → 배지 크기 */
const badgeSizes = (items: readonly MenuItem[], ctx: MarkerCtx): Map<string, number> => {
  const centers = items.filter((it) => it.bbox).map((it) => ({ id: it.id, x: ((it.bbox![0] + it.bbox![2]) / 2 / 1000) * ctx.W * ctx.fit.scale * ctx.zoom, y: ((it.bbox![1] + it.bbox![3]) / 2 / 1000) * ctx.Hi * ctx.fit.scale * ctx.zoom }));
  const out = new Map<string, number>();
  for (const c of centers) {
    let nn = Infinity;
    for (const o of centers) if (o !== c) nn = Math.min(nn, Math.hypot(o.x - c.x, o.y - c.y));
    out.set(c.id, Math.round(Math.max(BADGE_MIN, Math.min(BADGE_MAX, nn * 0.85))));
  }
  return out;
};

/**
 * 원문 자리를 한글로 덮어씌우는 라벨 (파파고식). 제목·안내문구·비메뉴 사진의 문장에 쓴다.
 * 상자 크기는 원문 bbox 그대로, 글자 크기는 상자 높이(세로쓰기는 너비)에서 정한다.
 */
const CoverLabel = ({ bbox, text, W, Hi, onClick }: { bbox: readonly [number, number, number, number]; text: string; W: number; Hi: number; onClick?: () => void }) => {
  const [x0, y0, x1, y1] = bbox;
  const wPx = ((x1 - x0) / 1000) * W, hPx = ((y1 - y0) / 1000) * Hi;
  const vertical = hPx > wPx * 2;
  const unit = vertical ? wPx : hPx;
  // 원문보다 조금 커도 읽히는 쪽을 택한다: 글자 크기 최소 9px, 상자 최소 14px
  const fontSize = Math.max(9, Math.min(unit * 0.72, 28));
  const minSide = Math.max(14, unit);
  return (
    <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{ position: 'absolute', left: `${x0 / 10}%`, top: `${y0 / 10}%`, width: vertical ? minSide : `${(x1 - x0) / 10}%`, height: vertical ? `${(y1 - y0) / 10}%` : minSide, boxSizing: 'border-box', padding: '0 3px',
        background: 'rgba(251,246,236,.97)', color: 'var(--ink)', border: '1px solid rgba(42,33,27,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        fontSize, lineHeight: 1.1, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', writingMode: vertical ? 'vertical-rl' : 'horizontal-tb', cursor: onClick ? 'pointer' : 'default' }}>
      {text}
    </div>
  );
};

/**
 * 메뉴판 사진 위에 번역을 붙인다.
 * 항목이 적으면 이름·가격 칩, 많으면 번호 배지(탭하면 상세). 배지는 이웃과의 거리에 맞춰 작아지고,
 * 사진을 두 손가락으로 확대하면 화면상 크기는 그대로라 겹침이 풀린다.
 */
export const OverlayView = ({ scan, selectedId, onSelect }: Props) => {
  const badges = scan.kind === 'menu' && scan.items.length > CHIP_LIMIT;
  const [showMarks, setShowMarks] = useState(true);
  const rot = scan.rotation + scan.tilt;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="frame" style={{ boxShadow: '4px 4px 0 var(--ink)', overflow: 'hidden', position: 'relative' }}>
        <button type="button" onClick={() => setShowMarks((v) => !v)} aria-pressed={showMarks}
          style={{ position: 'absolute', top: 8, right: 8, zIndex: 5, height: 32, padding: '0 10px', background: showMarks ? 'var(--ink)' : 'var(--paper-2)', color: showMarks ? 'var(--paper)' : 'var(--ink)', border: '2px solid var(--ink)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {showMarks ? '표시 끄기' : '표시 켜기'}
        </button>
        <MenuPhoto src={scan.imageDataUrl} width={scan.width} height={scan.height} words={scan.words} rotation={scan.rotation} tilt={scan.tilt} maxHeight={620} zoomable>
          {(ctx) => {
            if (!showMarks) return null;
            const covers = scan.notes.filter((n) => n.bbox).map((n, i) => <CoverLabel key={`n${i}`} bbox={n.bbox!} text={n.text_ko} W={ctx.W} Hi={ctx.Hi} />);
            if (scan.kind !== 'menu') {
              return [...covers, ...scan.items.filter((it) => it.bbox).map((it) => <CoverLabel key={it.id} bbox={it.bbox!} text={it.name_ko} W={ctx.W} Hi={ctx.Hi} onClick={() => onSelect(it)} />)];
            }
            const sizes = badges ? badgeSizes(scan.items, ctx) : null;
            const ms = ctx.markerScale;
            const marks = scan.items.map((it, i) => {
              if (!it.bbox) return null;
              const [x0, y0, x1, y1] = it.bbox;
              const selected = it.id === selectedId;
              const vertical = y1 - y0 > (x1 - x0) * 2;
              const cx = (x0 + x1) / 2;
              if (badges) {
                const size = sizes?.get(it.id) ?? BADGE_MAX;
                return (
                  <button key={it.id} type="button" onClick={() => onSelect(it)} aria-pressed={selected} aria-label={`${i + 1}번 ${it.name_ko} ${formatJpy(it.price_jpy)}`}
                    className="dot"
                    style={{ position: 'absolute', left: `${cx / 10}%`, top: `${(y0 + y1) / 2 / 10}%`, transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${ms})`, width: size, height: size, padding: 0, cursor: 'pointer',
                      background: selected ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper)', border: '2px solid var(--paper-2)', boxShadow: '2px 2px 0 rgba(42,33,27,.6)', fontSize: Math.max(9, size / 2), lineHeight: 1, zIndex: selected ? 3 : 1 }}>
                    {i + 1}
                  </button>
                );
              }
              const lane = vertical ? i % 3 : 0;
              const top = vertical ? Math.min(y0 + 40 + lane * 95, 900) : Math.min(y1, 960);
              const align = cx < 200 ? 'translateX(-20%)' : cx > 800 ? 'translateX(-80%)' : 'translateX(-50%)';
              return (
                <button key={it.id} type="button" onClick={() => onSelect(it)} aria-pressed={selected} aria-label={`${it.name_ko} ${formatJpy(it.price_jpy)}`}
                  style={{ position: 'absolute', left: `${cx / 10}%`, top: `${top / 10}%`, transform: `${align} rotate(${rot}deg) scale(${ms})`, transformOrigin: 'top center', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '4px 7px', cursor: 'pointer',
                    background: selected ? 'var(--vermilion)' : 'var(--paper-2)', color: selected ? 'var(--paper-2)' : 'var(--ink)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', maxWidth: vertical ? '33%' : '46%', textAlign: 'left', zIndex: selected ? 3 : 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{shortName(it.name_ko)}</span>
                  <span className="dot" style={{ fontSize: 11, lineHeight: 1 }}>{formatJpy(it.price_jpy)}</span>
                </button>
              );
            });
            return [...covers, ...marks];
          }}
        </MenuPhoto>
      </div>
      <div className="muted small" style={{ textAlign: 'center' }}>{badges ? '번호를 탭하면 상세가 열려요 · 두 손가락으로 확대, 두 번 탭하면 원래대로' : scan.kind !== 'menu' ? '번역을 탭하면 원문과 설명이 열려요 · 두 손가락으로 확대' : '칩을 탭하면 설명과 원화 가격이 열려요'}</div>
      {badges && (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 10px' }}>
          {scan.items.map((it, i) => (
            <li key={it.id}>
              <button type="button" onClick={() => onSelect(it)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: '4px 0', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                <span className="dot" style={{ width: 22, height: 22, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: it.id === selectedId ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper)', fontSize: 12 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortName(it.name_ko)}</span>
                <span className="dot muted" style={{ fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>{formatJpy(it.price_jpy)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
