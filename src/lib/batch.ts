/** 한 번에 읽을 수 있는 최대 장수. 그 이상은 앞에서부터 쓴다. 기록에서 묶음을 열 때 이 수만큼 사진을 메모리에 올린다 */
export const BATCH_MAX = 6;
/** 여러 장 동시 처리의 동시성 제한. 사진마다 독립 스트림을 열되 한꺼번에 너무 많이 열지 않는다 */
export const BATCH_CONCURRENCY = 3;

/** 작업을 limit 개씩 동시에 돌린다. 하나가 끝나면 다음을 시작. 실패해도 나머지는 계속 */
export const runLimited = async (tasks: ReadonlyArray<() => Promise<void>>, limit: number): Promise<void> => {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const task = tasks[next++]!;
      try { await task(); } catch { /* 각 작업이 자기 오류를 화면에 반영한다 */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
};
