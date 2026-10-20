/**
 * 새 빌드 감지. iOS 의 홈 화면 앱(standalone)은 시작 페이지를 오래 캐시해 배포 후에도 옛 화면이 뜬다.
 * 앱이 열리거나 다시 보일 때 /version.json 을 캐시 없이 읽어, 내 빌드 id 와 다르면 한 번 새로고침한다.
 */
declare const __BUILD_ID__: string;

const RELOAD_KEY = 'menulens.reloadedFor';

const check = async (): Promise<void> => {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const { id } = (await res.json()) as { id?: string };
    if (!id || id === __BUILD_ID__) return;
    if (sessionStorage.getItem(RELOAD_KEY) === id) return; // 같은 버전으로 이미 새로고침했는데도 다르면 루프 방지
    sessionStorage.setItem(RELOAD_KEY, id);
    location.reload();
  } catch { /* 오프라인이면 그대로 둔다 */ }
};

export const watchForUpdates = (): void => {
  void check();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void check(); });
};
