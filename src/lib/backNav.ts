import { useEffect, useRef } from 'react';

/**
 * 시스템 뒤로 가기(안드로이드 뒤로 버튼, iOS Safari 가장자리 스와이프, PC 브라우저 뒤로)를 앱 안의 「한 단계 뒤로」로 잇는다.
 * 앱은 주소 하나에 상태로 화면을 바꾸므로 그대로 두면 뒤로 가기가 앱을 벗어난다.
 *
 * 방식: 지금 깊이(화면 깊이 + 열린 시트·팝업 수)만큼 방문 기록에 칸을 쌓아 둔다. 칸에는 번호(1, 2, …)를 단다.
 * - 깊어질 때(탭으로 화면을 열거나 시트를 열 때) 모자란 칸을 pushState 로 채운다.
 * - 뒤로 가기가 칸을 하나 꺼내면(popstate) 맨 위 시트를 닫거나, 없으면 화면을 한 단계 뒤로 옮긴다. 그러면 깊이가 칸 수와 다시 맞는다.
 * - 앱 안 ◀ 로 얕아지면 남는 칸을 history.go(-n) 으로 걷는다(이때 오는 popstate 는 무시).
 * 뒤로 가기 처리 중에는 칸을 새로 쌓지 않는다: Chrome 은 사용자 동작 없이 쌓은 칸의 앞 칸을 뒤로 가기에서 건너뛰게 표시해,
 * 거기서 쌓으면 연속 뒤로 가기가 앱을 통째로 나갈 수 있다(2026-11-09 리뷰). 깊이가 그대로인 경우(중단 확인 창이 뜸 등)만 예외로 다시 쌓는다.
 */

type Layer = { readonly id: number; readonly close: () => void };

const KEY = 'menulensDepth';
const indexOf = (state: unknown): number => {
  const v = typeof state === 'object' && state !== null ? (state as Record<string, unknown>)[KEY] : undefined;
  return typeof v === 'number' && v > 0 ? v : 0;
};

/** 열린 시트·팝업(나중에 연 것이 뒤). 뒤로 가기와 Escape 는 맨 뒤 것부터 닫는다 */
let layers: readonly Layer[] = [];
/** 지금 화면의 「한 단계 뒤로」와 깊이(홈 0). 뒤로가 null 이면 더 갈 곳 없음 → 뒤로 가기는 앱을 나간다 */
let screenBack: (() => void) | null = null;
let screenDepth = 0;
/** 지금 방문 기록에서 앱이 쌓은 칸 중 몇 번째에 있는가(0 = 앱 첫 칸) */
let at = 0;
/** 칸을 걷으려고 직접 부른 history.go 가 일으킬 popstate 수(무시한다) */
let skipPops = 0;
let nextId = 1;
let scheduled = false;
let installed = false;

const depth = (): number => (screenBack ? screenDepth : 0) + layers.length;

/** 깊이에 맞춰 칸을 쌓거나 걷는다 */
const sync = (): void => {
  const want = depth();
  if (want > at) {
    for (let i = at + 1; i <= want; i++) history.pushState({ [KEY]: i }, '');
    at = want;
  } else if (want < at && skipPops === 0) {
    skipPops += 1;
    history.go(want - at);
  }
};

/** 한 커밋 안에서 닫고 여는 일이 겹쳐도(시트를 닫으며 챗을 여는 등) 한 번만 맞추도록 마이크로태스크로 미룬다 */
const schedule = (): void => {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; sync(); });
};

const onPop = (e: PopStateEvent): void => {
  const now = indexOf(e.state);
  if (skipPops > 0) { skipPops -= 1; at = now; schedule(); return; }
  const backward = now < at;
  at = now;
  // 앞으로 가기는 화면을 바꾸지 않는다(깊이에 맞춰 칸만 다시 걷는다)
  if (backward) {
    const top = layers[layers.length - 1];
    if (top) top.close();
    else screenBack?.();
  }
  schedule();
};

const onKey = (e: KeyboardEvent): void => {
  if (e.key !== 'Escape') return;
  const top = layers[layers.length - 1];
  if (top) top.close();
};

const install = (): void => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  at = indexOf(history.state);
  // 칸을 오가며 브라우저가 옛 스크롤 위치를 되살리면 화면별 스크롤(useScreenScroll)과 싸운다
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('popstate', onPop);
  window.addEventListener('keydown', onKey);
};

// 개발 중 이 파일을 고치면 모듈이 다시 실행되므로 옛 리스너를 떼어 낸다
if (import.meta.hot) import.meta.hot.dispose(() => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); });

/** 화면의 「한 단계 뒤로」와 깊이(홈에서 몇 번 들어왔나)를 등록한다. back 이 null 이면 홈. 함수는 매 렌더 최신 것을 쓴다 */
export const useBackScreen = (back: (() => void) | null, depthOfScreen: number): void => {
  const latest = useRef(back);
  latest.current = back;
  const has = back !== null;
  useEffect(() => {
    install();
    screenBack = has ? () => latest.current?.() : null;
    screenDepth = depthOfScreen;
    schedule();
  }, [has, depthOfScreen]);
};

/** 열려 있는 동안 시스템 뒤로 가기와 Escape 가 이 시트·팝업을 먼저 닫게 한다 */
export const useBackLayer = (open: boolean, close: () => void): void => {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open) return;
    install();
    const layer: Layer = { id: nextId++, close: () => latest.current() };
    layers = [...layers, layer];
    schedule();
    return () => { layers = layers.filter((l) => l.id !== layer.id); schedule(); };
  }, [open]);
};
