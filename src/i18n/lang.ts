/**
 * 앱 언어(UI 언어 = 번역 대상 언어). 기본값은 기기 언어(일본어면 ja, 아니면 ko)이고 홈 오른쪽 위 버튼으로 바꾼다.
 * React 밖(lib 함수·문구 사전)에서도 읽어야 해서 모듈 저장소로 두고, 화면은 useLang 으로 구독한다.
 */
import { useSyncExternalStore } from 'react';

export type AppLang = 'ko' | 'ja';
const KEY = 'menulens.lang';
const LANGS: readonly AppLang[] = ['ko', 'ja'];
/** 브라우저 탭 제목(언어별) */
const TITLE: Readonly<Record<AppLang, string>> = {
  ko: 'MenuLens · 일본 메뉴판·안내문을 찍으면 바로 읽어드려요',
  ja: 'MenuLens · 韓国のメニュー・案内を撮るとすぐ読めます',
};

export const detectLang = (): AppLang => (typeof navigator !== 'undefined' && (navigator.language ?? '').toLowerCase().startsWith('ja') ? 'ja' : 'ko');

const load = (): AppLang => {
  try {
    const raw = localStorage.getItem(KEY);
    return LANGS.includes(raw as AppLang) ? (raw as AppLang) : detectLang();
  } catch { return detectLang(); }
};

const applyToDocument = (lang: AppLang): void => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.title = TITLE[lang];
};

let current: AppLang = load();
applyToDocument(current);
const listeners = new Set<() => void>();

export const getLang = (): AppLang => current;
export const setLang = (lang: AppLang): void => {
  if (lang === current) return;
  current = lang;
  try { localStorage.setItem(KEY, lang); } catch { /* 무시 */ }
  applyToDocument(lang);
  listeners.forEach((f) => f());
};
export const toggleLang = (): void => setLang(current === 'ko' ? 'ja' : 'ko');
const subscribe = (f: () => void): (() => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
/** 화면에서 구독. 언어가 바뀌면 다시 그린다 */
export const useLang = (): AppLang => useSyncExternalStore(subscribe, getLang, getLang);
/** 반대 언어(사진 원문 언어의 기본값: ko UI 면 일본어 사진, ja UI 면 한국어 사진) */
export const otherLang = (lang: AppLang): AppLang => (lang === 'ko' ? 'ja' : 'ko');
