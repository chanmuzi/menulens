import { useCallback, useEffect, useState } from 'react';
import type { MenuItem, Rate, Scan } from '../types';
import { formatJpy, formatPriceOrBlank, payableJpy } from '../lib/money';
import { MenuPhoto, type MarkerCtx } from '../components/MenuPhoto';
import { loadSampler, sampleBox, type BoxColors } from '../lib/sample';
import { NoticeCovers, type CoverBlock } from '../components/NoticeCovers';
import { NoticePanel } from './NoticePanel';
import { useT } from '../i18n';

type Props = { readonly scan: Scan; readonly selectedId: string | null; readonly onSelect: (item: MenuItem) => void; /** 안내문 문단 선택(같은 문단을 다시 누르면 해제) */ readonly selectedNote: number | null; readonly onNote: (i: number) => void; readonly rate: Rate | null; /** 번역 표시(배지·덮개) 켜짐. 토글 버튼은 결과 화면 제목 줄에 있다 */ readonly showMarks: boolean };

/** 메뉴가 이 수를 넘으면 칩 대신 번호 배지를 붙인다. 회전된 사진은 칩 배치가 어긋나므로 항상 배지 */
const CHIP_LIMIT = 4;
/** 배지는 한 크기(제목급 항목만 커지면 어색하다). 붐빌 때만 BADGE_MIN 까지 줄어든다 */
const BADGE_MAX = 20;
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

/** 덮어쓸 상자들의 글자색을 사진에서 한 번 뽑는다 (사진이 바뀔 때만, 결과 화면이 뜬 뒤 비동기). 붉은 안내 글은 붉게 남도록 */
const useBoxColors = (imageDataUrl: string, boxes: ReadonlyArray<readonly [string, readonly [number, number, number, number]]>): ReadonlyMap<string, BoxColors> => {
  const [map, setMap] = useState<ReadonlyMap<string, BoxColors>>(new Map());
  const keys = boxes.map(([k]) => k).join('|');
  useEffect(() => {
    let alive = true;
    if (!imageDataUrl || boxes.length === 0) { setMap(new Map()); return; }
    void loadSampler(imageDataUrl).then((ctx) => {
      if (!alive || !ctx) return;
      setMap(new Map(boxes.map(([k, b]) => [k, sampleBox(ctx, b)] as const)));
    });
    return () => { alive = false; };
    // boxes 는 매 렌더 새 배열이라 키 문자열로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl, keys]);
  return map;
};

/**
 * 메뉴판 사진 위에 번역을 붙인다.
 * 항목이 적으면 이름·가격 칩, 많으면 번호 배지(탭하면 상세). 배지는 이웃과의 거리에 맞춰 작아지고,
 * 사진을 두 손가락으로 확대하면 화면상 크기는 그대로라 겹침이 풀린다.
 */
export const OverlayView = ({ scan, selectedId, onSelect, selectedNote, onNote, rate, showMarks }: Props) => {
  const t = useT();
  const badges = scan.kind === 'menu' && (scan.items.length > CHIP_LIMIT || scan.rotation !== 0);
  const rot = scan.rotation + scan.tilt;
  const isMenu = scan.kind === 'menu';
  // 메뉴판은 덮개를 그리지 않으므로(아래 covers) 색도 뽑지 않는다
  const colors = useBoxColors(scan.imageDataUrl, isMenu ? [] : [
    ...scan.notes.flatMap((n, i) => (n.bbox ? [[`n${i}`, n.bbox] as const] : [])),
    ...scan.items.flatMap((it) => (it.bbox ? [[it.id, it.bbox] as const] : [])),
  ]);
  // 번호 배지로만 찍힌 문단(덮개에 안 들어감) → 사진 아래 번역문에도 같은 번호를 단다
  const [coverBadges, setCoverBadges] = useState<ReadonlyMap<string, number>>(new Map());
  const onBadges = useCallback((b: ReadonlyMap<string, number>) => setCoverBadges(b), []);
  const noteBadges = new Map([...coverBadges].flatMap(([k, n]) => (k.startsWith('n') ? [[Number(k.slice(1)), n] as const] : [])));
  const blocks: CoverBlock[] = isMenu ? [] : [
    ...scan.notes.flatMap((n, i) => (n.bbox ? [{ key: `n${i}`, text: n.tr, lines: n.lines?.length ? n.lines : [n.bbox], title: n.role === 'title', badgeLabel: (k: number) => String(k), selected: selectedNote === i, onClick: () => onNote(i), colors: colors.get(`n${i}`) }] : [])),
    // 안내문에 상품명 같은 항목이 잡힌 경우: 덮개로 쓰고, 안 들어가면 점 배지(누르면 상세)
    ...scan.items.flatMap((it) => (it.bbox ? [{ key: `i${it.id}`, text: it.tr, lines: [it.bbox], title: false, badgeLabel: () => null, selected: it.id === selectedId, onClick: () => onSelect(it), colors: colors.get(it.id) }] : [])),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="frame" style={{ boxShadow: '4px 4px 0 var(--ink)', overflow: 'hidden', position: 'relative' }}>
        <MenuPhoto src={scan.imageDataUrl} width={scan.width} height={scan.height} words={scan.words} rotation={scan.rotation} tilt={scan.tilt} maxHeight={620} zoomable>
          {(ctx) => {
            if (!showMarks) return null;
            // 메뉴판은 번호 배지만 남긴다. 분류 제목·안내 문구 덮기는 사진을 어지럽혀 안내문·기타에서만 쓴다
            if (!isMenu) return <NoticeCovers blocks={blocks} ctx={ctx} rotation={scan.rotation} rot={rot} onBadges={onBadges} />;
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
                  <button key={it.id} type="button" onClick={() => onSelect(it)} aria-pressed={selected} aria-label={t.result.badgeAria(i + 1, it.tr, formatPriceOrBlank(it))}
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
                <button key={it.id} type="button" onClick={() => onSelect(it)} aria-pressed={selected} aria-label={`${it.tr} ${formatPriceOrBlank(it)}`}
                  style={{ position: 'absolute', left: `${cx / 10}%`, top: `${top / 10}%`, transform: `${align} rotate(${rot}deg) scale(${ms})`, transformOrigin: 'top center', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '4px 7px', cursor: 'pointer',
                    background: selected ? 'var(--vermilion)' : 'var(--paper-2)', color: selected ? 'var(--paper-2)' : 'var(--ink)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', maxWidth: vertical ? '33%' : '46%', textAlign: 'left', zIndex: selected ? 3 : 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{shortName(it.tr)}</span>
                  {payableJpy(it) !== null && <span className="dot" style={{ fontSize: 11, lineHeight: 1 }}>{formatJpy(payableJpy(it))}</span>}
                </button>
              );
            });
            return marks;
          }}
        </MenuPhoto>
      </div>
      {!isMenu && <NoticePanel scan={scan} rate={rate} selected={selectedNote} onSelect={onNote} badges={noteBadges} />}
      {badges && (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 10px' }}>
          {scan.items.map((it, i) => (
            <li key={it.id}>
              <button type="button" onClick={() => onSelect(it)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: '4px 0', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                <span className="dot" style={{ width: 22, height: 22, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: it.id === selectedId ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper)', fontSize: 12 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortName(it.tr)}</span>
                <span className="dot muted" style={{ fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>{formatPriceOrBlank(it)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
