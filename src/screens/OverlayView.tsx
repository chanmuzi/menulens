import { useEffect, useState } from 'react';
import type { MenuItem, Note, Scan } from '../types';
import { formatJpy, formatPriceOrBlank, payableJpy } from '../lib/money';
import { MenuPhoto, type MarkerCtx } from '../components/MenuPhoto';
import { loadSampler, patchBox, sampleBox, type BoxColors, type BoxPatch } from '../lib/sample';

type Props = { readonly scan: Scan; readonly selectedId: string | null; readonly onSelect: (item: MenuItem) => void; /** 안내문 줄을 탭했을 때 */ readonly onNote?: (note: Note) => void };

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

/**
 * 원문 자리를 한글로 덮어씌우는 라벨 (파파고식). 제목·안내문구·비메뉴 사진의 문장에 쓴다.
 * 상자 크기는 원문 bbox 그대로, 글자 크기는 상자 높이(세로쓰기는 너비)에서 정한다.
 */
/** 글자 폭 추정(em): CJK 1, 그 외 0.55 */
const textEm = (t: string): number => [...t].reduce((n, ch) => n + (/[\u1100-\u11FF\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? 1 : 0.55), 0);

/** 상자에 두 줄 이내로 들어가는지 (안 들어가면 제자리 덮기 대신 ※마커 + 아래 목록) */
const fitsInBox = (bbox: readonly [number, number, number, number], text: string, W: number, Hi: number): boolean => {
  const [x0, y0, x1, y1] = bbox;
  const wPx = ((x1 - x0) / 1000) * W, hPx = ((y1 - y0) / 1000) * Hi;
  const vertical = hPx > wPx * 2;
  const along = vertical ? hPx : wPx, across = vertical ? wPx : hPx;
  const em = Math.max(1, textEm(text));
  const oneLine = Math.min(across * 0.78, (along * 0.94) / em);
  if (oneLine >= 9) return true;
  const twoLineFont = Math.min(across * 0.78, 12, (along * 0.94 * 2) / em);
  return twoLineFont >= 9;
};

const NoteMarker = ({ bbox, n, scale }: { bbox: readonly [number, number, number, number]; n: number; scale: number }) => (
  <div aria-hidden="true" className="dot" style={{ position: 'absolute', left: `${bbox[0] / 10}%`, top: `${bbox[1] / 10}%`, transform: `translate(-20%, -20%) scale(${scale})`, transformOrigin: 'top left',
    background: 'var(--paper-2)', color: 'var(--vermilion)', border: '2px solid var(--vermilion)', fontSize: 11, lineHeight: 1, padding: '2px 4px', zIndex: 2 }}>※{n}</div>
);

/** 덮개 하나의 겉모습: 사진에서 뽑은 색과, 글자 획만 지운 배경 조각(없으면 단색) */
type BoxLook = { readonly colors: BoxColors; readonly patch: BoxPatch | null };

type CoverProps = { bbox: readonly [number, number, number, number]; text: string; W: number; Hi: number; rotation: number; rot: number; look?: BoxLook; onClick?: () => void };

/**
 * 파파고식 덮어쓰기: 원문 자리를 덮고 원문 글자색으로 번역을 쓴다. 테두리 없음.
 * 덮는 층은 사진에서 글자 획만 지운 배경 조각(`patchBox`)이라 종이 질감·그라데이션이 이어진다. 조각을 못 만들면 샘플링한 단색.
 * 사진 층이 rot 만큼 돌아가 있으므로 라벨은 역회전해 바로 세운다(번호 배지와 같은 방식). 90·270 이면 화면상 가로·세로가 바뀐다.
 */
/** 덮개 라벨 치수: 화면 기준 방향·굵기·한 줄 글자 크기·접힘 여부 (CoverLabel 과 조각 요청이 같은 식을 쓴다) */
const coverMetrics = (bbox: readonly [number, number, number, number], text: string, rotation: number, W: number, Hi: number) => {
  const [x0, y0, x1, y1] = bbox;
  const rawW = ((x1 - x0) / 1000) * W, rawH = ((y1 - y0) / 1000) * Hi;
  const swap = rotation === 90 || rotation === 270;
  const wPx = swap ? rawH : rawW, hPx = swap ? rawW : rawH; // 화면 기준 상자 크기
  const vertical = hPx > wPx * 2;                              // 화면 기준 세로 글줄이면 세로쓰기
  const along = vertical ? hPx : wPx;   // 글줄 진행 방향 길이
  const across = vertical ? wPx : hPx;  // 글줄 굵기
  // 한 줄로 넣을 때 가능한 글자 크기: 굵기 기준과 길이 기준 중 작은 쪽. 원문 글자 크기(굵기)에 가깝게
  const oneLine = Math.min(across * 0.82, (along * 0.96) / Math.max(1, textEm(text)), 30);
  return { swap, wPx, hPx, vertical, across, oneLine, wrap: oneLine < 9 } as const;
};

const CoverLabel = ({ bbox, text, W, Hi, rotation, rot, look, onClick }: CoverProps) => {
  const colors = look?.colors, patch = look?.patch ?? null;
  const [x0, y0, x1, y1] = bbox;
  const { swap, wPx, hPx, vertical, across, oneLine, wrap } = coverMetrics(bbox, text, rotation, W, Hi);
  const fontSize = wrap ? Math.max(10, Math.min(across * 0.82, 12)) : oneLine;
  const bg = colors?.bg ?? 'rgba(251,246,236,.97)', fg = colors?.fg ?? 'var(--ink)';
  // 조각이 있으면 글자 상자는 투명하게 두고 조각이 배경을 맡는다. 줄 바꿈으로 상자가 조각보다 커지면 단색으로 되돌아간다.
  // 조각 상자는 사진 좌표라, 화면 기준 굵기 방향이 사진의 x축인지(vertical ≠ swap) 보고 잰다
  const acrossIsX = vertical !== swap;
  const patchAcross = patch ? (acrossIsX ? ((patch.box[2] - patch.box[0]) / 1000) * W : ((patch.box[3] - patch.box[1]) / 1000) * Hi) : 0;
  const solid = patch === null || (wrap && patchAcross < fontSize * 1.1 * 2 + 4);
  return (
    <>
      {/* 조각은 라벨(zIndex 2)보다 아래(1). 같은 층이면 뒤 줄의 조각이 앞 줄의 번역을 덮는다 */}
      {patch && (
        <img src={patch.url} alt="" aria-hidden="true" draggable={false}
          style={{ position: 'absolute', left: `${patch.box[0] / 10}%`, top: `${patch.box[1] / 10}%`, width: `${(patch.box[2] - patch.box[0]) / 10}%`, height: `${(patch.box[3] - patch.box[1]) / 10}%`, zIndex: 1, pointerEvents: 'none', maxWidth: 'none' }} />
      )}
    <div style={{ position: 'absolute', left: `${x0 / 10}%`, top: `${y0 / 10}%`, width: `${(x1 - x0) / 10}%`, height: `${(y1 - y0) / 10}%`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, pointerEvents: 'none' }}>
      <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
        style={{ flexShrink: 0, transform: `rotate(${rot}deg)`,
          width: vertical ? Math.max(across, fontSize * 1.3) : wPx, height: vertical ? hPx : (wrap ? 'auto' : Math.max(across, fontSize * 1.3)), minHeight: vertical ? undefined : across,
          boxSizing: 'border-box', padding: vertical ? '2px 0' : '0 2px', background: solid ? bg : 'transparent', color: fg, boxShadow: solid ? `0 0 0 2px ${bg}` : undefined,
          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize, lineHeight: 1.1, fontWeight: 600,
          overflow: 'visible', whiteSpace: wrap ? 'normal' : 'nowrap', wordBreak: 'keep-all', writingMode: vertical ? 'vertical-rl' : 'horizontal-tb', textOrientation: vertical ? 'upright' : undefined,
          cursor: onClick ? 'pointer' : 'default', pointerEvents: 'auto' }}>
        {text}
      </div>
    </div>
    </>
  );
};

/** 덮어쓸 상자들의 색과 배경 조각을 사진에서 한 번 만든다 (사진이 바뀔 때만, 결과 화면이 뜬 뒤 비동기) */
const useBoxLooks = (imageDataUrl: string, boxes: ReadonlyArray<readonly [string, readonly [number, number, number, number], boolean]>): ReadonlyMap<string, BoxLook> => {
  const [map, setMap] = useState<ReadonlyMap<string, BoxLook>>(new Map());
  const keys = boxes.map(([k]) => k).join('|');
  useEffect(() => {
    let alive = true;
    if (!imageDataUrl || boxes.length === 0) { setMap(new Map()); return; }
    void loadSampler(imageDataUrl).then((ctx) => {
      if (!alive || !ctx) return;
      const t0 = performance.now();
      // 접힐 상자는 굵기 방향으로 1.2배 더 넓게 잘라 두 줄이 모두 조각 위에 놓이게 한다
      const next = new Map(boxes.map(([k, b, wrap]) => [k, { colors: sampleBox(ctx, b), patch: patchBox(ctx, b, wrap ? 1.2 : 0.18) }] as const));
      if (import.meta.env.DEV) console.debug(`[overlay] 덮개 조각 ${boxes.length}개 ${Math.round(performance.now() - t0)}ms`);
      setMap(next);
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
export const OverlayView = ({ scan, selectedId, onSelect, onNote }: Props) => {
  const badges = scan.kind === 'menu' && (scan.items.length > CHIP_LIMIT || scan.rotation !== 0);
  const [showMarks, setShowMarks] = useState(true);
  const rot = scan.rotation + scan.tilt;
  const approxW = 350, approxHi = (approxW * scan.height) / scan.width;
  const isMenu = scan.kind === 'menu';
  // 안내문은 줄 단위로 번역되므로 길어도 제자리에 덮는다(줄 바꿈·아래로 늘어남). 메뉴판의 긴 안내만 ※ 목록으로 뺀다
  const longNotes: typeof scan.notes = [];
  // 메뉴판은 덮개를 그리지 않으므로(아래 covers) 조각도 만들지 않는다. 접힐 상자는 폭 350px 기준으로 미리 판정해 조각을 넓게 요청한다
  const wraps = (bbox: readonly [number, number, number, number], text: string) => coverMetrics(bbox, text, scan.rotation, approxW, approxHi).wrap;
  const looks = useBoxLooks(scan.imageDataUrl, isMenu ? [] : [
    ...scan.notes.flatMap((n, i) => (n.bbox ? [[`n${i}`, n.bbox, wraps(n.bbox, n.text_ko)] as const] : [])),
    ...scan.items.flatMap((it) => (it.bbox ? [[it.id, it.bbox, wraps(it.bbox, it.name_ko)] as const] : [])),
  ]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setShowMarks((v) => !v)} aria-pressed={showMarks}
          style={{ height: 32, padding: '0 10px', background: showMarks ? 'var(--ink)' : 'var(--paper-2)', color: showMarks ? 'var(--paper)' : 'var(--ink)', border: '2px solid var(--ink)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
          {showMarks ? '표시 끄기' : '표시 켜기'}
        </button>
      </div>
      <div className="frame" style={{ boxShadow: '4px 4px 0 var(--ink)', overflow: 'hidden', position: 'relative' }}>
        <MenuPhoto src={scan.imageDataUrl} width={scan.width} height={scan.height} words={scan.words} rotation={scan.rotation} tilt={scan.tilt} maxHeight={620} zoomable>
          {(ctx) => {
            if (!showMarks) return null;
            let marker = 0;
            // 메뉴판은 번호 배지만 남긴다. 분류 제목·안내 문구 덮기는 사진을 어지럽혀 안내문(sign)에서만 쓴다
            const covers = isMenu ? [] : scan.notes.filter((n) => n.bbox).map((n, i) =>
              !isMenu || fitsInBox(n.bbox!, n.text_ko, approxW, approxHi) // 아래 목록과 같은 기준으로 판정해 번호가 맞도록
                ? <CoverLabel key={`n${i}`} bbox={n.bbox!} text={n.text_ko} W={ctx.W} Hi={ctx.Hi} rotation={scan.rotation} rot={rot} look={looks.get(`n${i}`)} onClick={onNote ? () => onNote(n) : undefined} />
                : <NoteMarker key={`n${i}`} bbox={n.bbox!} n={++marker} scale={ctx.markerScale} />);
            if (!isMenu) {
              return [...covers, ...scan.items.filter((it) => it.bbox).map((it) => <CoverLabel key={it.id} bbox={it.bbox!} text={it.name_ko} W={ctx.W} Hi={ctx.Hi} rotation={scan.rotation} rot={rot} look={looks.get(it.id)} onClick={() => onSelect(it)} />)];
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
                  <button key={it.id} type="button" onClick={() => onSelect(it)} aria-pressed={selected} aria-label={`${i + 1}번 ${it.name_ko} ${formatPriceOrBlank(it)}`}
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
                <button key={it.id} type="button" onClick={() => onSelect(it)} aria-pressed={selected} aria-label={`${it.name_ko} ${formatPriceOrBlank(it)}`}
                  style={{ position: 'absolute', left: `${cx / 10}%`, top: `${top / 10}%`, transform: `${align} rotate(${rot}deg) scale(${ms})`, transformOrigin: 'top center', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '4px 7px', cursor: 'pointer',
                    background: selected ? 'var(--vermilion)' : 'var(--paper-2)', color: selected ? 'var(--paper-2)' : 'var(--ink)', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)', maxWidth: vertical ? '33%' : '46%', textAlign: 'left', zIndex: selected ? 3 : 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{shortName(it.name_ko)}</span>
                  {payableJpy(it) !== null && <span className="dot" style={{ fontSize: 11, lineHeight: 1 }}>{formatJpy(payableJpy(it))}</span>}
                </button>
              );
            });
            return [...covers, ...marks];
          }}
        </MenuPhoto>
      </div>
      {longNotes.length > 0 && (
        <ul style={{ margin: 0, padding: '10px 12px', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--paper-dark)', border: '2px solid var(--ink)' }}>
          {longNotes.map((n, i) => (
            <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, lineHeight: 1.45 }}>
              <span className="dot" style={{ color: 'var(--vermilion)', flexShrink: 0 }}>※{i + 1}</span>
              <span>{n.text_ko}</span>
            </li>
          ))}
        </ul>
      )}
      {!isMenu && scan.notes.length > 0 && (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scan.notes.map((n, i) => (
            <li key={i}>
              <button type="button" onClick={onNote ? () => onNote(n) : undefined} className="frame frame--flat" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'var(--paper-2)', cursor: onNote ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="jp" style={{ fontSize: 15, fontWeight: 500, color: 'var(--body)' }}>{n.text_ja}</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{n.text_ko}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="muted small" style={{ textAlign: 'center' }}>{badges ? '번호를 탭하면 상세가 열려요 · 두 손가락으로 확대, 두 번 탭하면 원래대로' : scan.kind !== 'menu' ? '번역을 탭하면 원문이 크게 열려요 · 두 손가락으로 확대' : '칩을 탭하면 설명과 원화 가격이 열려요'}</div>
      {badges && (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 10px' }}>
          {scan.items.map((it, i) => (
            <li key={it.id}>
              <button type="button" onClick={() => onSelect(it)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: '4px 0', cursor: 'pointer', textAlign: 'left', color: 'inherit' }}>
                <span className="dot" style={{ width: 22, height: 22, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: it.id === selectedId ? 'var(--vermilion)' : 'var(--ink)', color: 'var(--paper)', fontSize: 12 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortName(it.name_ko)}</span>
                <span className="dot muted" style={{ fontSize: 11, marginLeft: 'auto', flexShrink: 0 }}>{formatPriceOrBlank(it)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
