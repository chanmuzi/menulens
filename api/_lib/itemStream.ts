/**
 * 스트리밍 JSON 텍스트에서 "items": [ ... ] 안의 객체를 완성되는 즉시 꺼낸다 (서버용).
 * 전체 JSON 이 끝나기 전에도 동작한다.
 */
export type ItemParser = { readonly push: (chunk: string) => readonly unknown[]; readonly text: () => string };

export const createItemParser = (): ItemParser => {
  let buf = '';
  let pos = 0;
  let started = false;
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

/** 코드펜스나 앞뒤 잡음이 섞여도 첫 { 부터 마지막 } 까지를 파싱한다 */
export const parseLoose = (text: string): unknown => {
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no json object');
  return JSON.parse(text.slice(a, b + 1));
};
