/** 플랫폼 감지와 「홈 화면에 추가」 안내 상태. UA 판별은 안내 노출에만 쓰고 기능 분기에는 쓰지 않는다. */
import { useEffect, useState } from 'react';

const KEY_HINT_DISMISSED = 'menulens.addToHomeDismissed';

/** 이미 홈 화면 웹앱으로 열렸는지 (iOS `navigator.standalone`, 그 외 display-mode) */
export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
};

/** iPhone·iPad(iPadOS 는 Mac UA 를 쓰므로 터치 포인트로 구분) */
export const isIos = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const readDismissed = (): boolean => { try { return localStorage.getItem(KEY_HINT_DISMISSED) === '1'; } catch { return false; } };
const writeDismissed = (): void => { try { localStorage.setItem(KEY_HINT_DISMISSED, '1'); } catch { /* 무시 */ } };

type BeforeInstallPromptEvent = Event & { readonly prompt: () => Promise<void> };

export type InstallHint =
  | { readonly kind: 'none' }
  /** iOS: 공유 → 홈 화면에 추가 안내만 가능 */
  | { readonly kind: 'ios'; readonly dismiss: () => void }
  /** Android Chrome 등: 브라우저 설치 프롬프트를 바로 띄울 수 있음 */
  | { readonly kind: 'prompt'; readonly install: () => Promise<void>; readonly dismiss: () => void };

/** 홈 화면 추가 안내를 어떤 형태로 보여줄지. 이미 설치됐거나 닫은 적 있으면 none */
export const useInstallHint = (): InstallHint => {
  const [dismissed, setDismissed] = useState<boolean>(() => readDismissed());
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setPromptEvent(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = () => { writeDismissed(); setDismissed(true); };
  if (dismissed || isStandalone()) return { kind: 'none' };
  if (promptEvent) return { kind: 'prompt', dismiss, install: async () => { await promptEvent.prompt(); setPromptEvent(null); } };
  if (isIos()) return { kind: 'ios', dismiss };
  return { kind: 'none' };
};
