import { useEffect, useLayoutEffect, useRef } from 'react';

/** 화면 이름. App 이 지금 그리는 화면(라우트 + 자르기·처리 중 같은 갈래)을 하나의 문자열로 넘긴다 */
export type ScreenKey = 'gate' | 'home' | 'history' | 'confirm' | 'crop' | 'processing' | 'result' | 'talk';

/** 목록 화면: 떠날 때 위치를 기억했다가 하위 화면에서 돌아오면 그 자리로 되돌린다 */
const LIST_SCREENS: readonly ScreenKey[] = ['home', 'history'];

/** 이 화면으로 들어올 때 기억한 위치를 쓰는가. 전체 보기는 홈에서 새로 열면 맨 위, 결과·대화에서 돌아오면 보던 자리 */
const restores = (to: ScreenKey, from: ScreenKey): boolean => {
  if (to === 'home') return true;
  if (to === 'history') return from !== 'home';
  return false;
};

/**
 * 화면이 바뀔 때 창 스크롤을 정리한다. 앱은 창 전체가 스크롤되므로 화면을 갈아끼워도 scrollY 가 남아,
 * 홈에서 내려 본 상태로 기록을 열면 결과 화면이 중간부터 보였다(2026-11-09 피드백).
 * 새 화면은 맨 위에서 시작하고, 목록(홈·전체 보기)으로 돌아오면 떠날 때 위치로 되돌린다.
 */
export const useScreenScroll = (screen: ScreenKey): void => {
  const saved = useRef(new Map<ScreenKey, number>());
  const prev = useRef(screen);
  /** 마지막으로 본 스크롤 위치. 화면이 바뀐 직후 DOM 은 이미 새 화면이라 그 시점의 scrollY 는 줄어든 높이에 눌린 값일 수 있어 이벤트로 들고 있는다 */
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => { lastY.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 그리기 전에 옮겨야 새 화면이 옛 위치에서 한 번 보였다가 튀지 않는다
  useLayoutEffect(() => {
    const from = prev.current;
    if (from === screen) return;
    prev.current = screen;
    if (LIST_SCREENS.includes(from)) saved.current.set(from, lastY.current);
    const y = restores(screen, from) ? (saved.current.get(screen) ?? 0) : 0;
    window.scrollTo(0, y);
    lastY.current = window.scrollY;
  }, [screen]);
};
