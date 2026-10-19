/**
 * 스트리밍으로 도착하는 JSON 텍스트에서 "items": [ ... ] 안의 객체를
 * 하나씩 완성되는 즉시 꺼내 준다. 전체 JSON 이 끝나기 전에도 동작한다.
 */

export type ItemParser = {
  readonly push: (chunk: string) => readonly unknown[];
  readonly text: () => string;
};

export const createItemParser = (): ItemParser => {
  let buf = '';
  let pos = 0;          // 다음에 검사할 위치
  let started = false;  // "items": [ 를 지났는가
  let depth = 0;
  let inStr = false;
  let esc = false;
  let objStart = -1;

  const push = (chunk: string): readonly unknown[] => {
    buf += chunk;
    if (!started) {
      const i = buf.indexOf('"items"');
      if (i < 0) return [];
      const j = buf.indexOf('[', i);
      if (j < 0) return [];
      started = true;
      pos = j + 1;
    }
    const found: unknown[] = [];
    for (; pos < buf.length; pos++) {
      const ch = buf[pos];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') { if (depth === 0) objStart = pos; depth++; continue; }
      if (ch === '}') {
        depth--;
        if (depth === 0 && objStart >= 0) {
          try { found.push(JSON.parse(buf.slice(objStart, pos + 1))); } catch { /* 깨진 항목은 건너뜀 */ }
          objStart = -1;
        }
      }
    }
    return found;
  };

  return { push, text: () => buf };
};

/** 가게 이름 (없으면 null). items 앞에 오므로 스트림 초반에도 뽑을 수 있다. */
export const extractShopName = (text: string): string | null => {
  const m = /"shop_name"\s*:\s*("(?:[^"\\]|\\.)*"|null)/.exec(text);
  if (!m || m[1] === 'null') return null;
  try { return JSON.parse(m[1]) as string; } catch { return null; }
};

/** 메뉴판 네 모서리 원시 배열 (없거나 아직 안 왔으면 undefined, 명시적 null 이면 null). */
export const extractQuadRaw = (text: string): unknown | null | undefined => {
  const m = /"sheet_quad"\s*:\s*(null|\[\s*\[[^\]]*\]\s*,\s*\[[^\]]*\]\s*,\s*\[[^\]]*\]\s*,\s*\[[^\]]*\]\s*\])/.exec(text);
  if (!m) return undefined;
  if (m[1] === 'null') return null;
  try { return JSON.parse(m[1]) as unknown; } catch { return undefined; }
};
