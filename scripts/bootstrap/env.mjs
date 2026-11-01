// .env 읽기·쓰기. 모르는 줄(주석·다른 변수)은 그대로 두고, 관리하는 변수만 바꾼다.
import fs from 'node:fs';

/** KEY=value 줄만 객체로. 따옴표는 벗긴다 */
export const readEnv = (path) => {
  if (!fs.existsSync(path)) return {};
  const out = {};
  for (const raw of fs.readFileSync(path, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(raw);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
};

/** 바뀐 값은 제자리에서 고치고, 새 변수는 끝에 붙인다. 값이 null 이면 그 줄을 지운다 */
export const writeEnv = (path, updates) => {
  const existing = fs.existsSync(path) ? fs.readFileSync(path, 'utf8').split('\n') : [];
  const seen = new Set();
  const lines = existing.flatMap((raw) => {
    const m = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/.exec(raw);
    if (!m || !(m[1] in updates)) return [raw];
    seen.add(m[1]);
    const v = updates[m[1]];
    return v === null ? [] : [`${m[1]}=${quote(v)}`];
  });
  for (const [k, v] of Object.entries(updates)) if (!seen.has(k) && v !== null && v !== undefined) lines.push(`${k}=${quote(v)}`);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  fs.writeFileSync(path, lines.join('\n') + '\n', { mode: 0o600 });
  fs.chmodSync(path, 0o600); // writeFileSync 의 mode 는 새 파일에만 적용된다. 이미 있던 644 파일도 600 으로
};

const quote = (v) => (/[\s#"'=]/.test(v) ? JSON.stringify(v) : v);

/** 화면에 보여 줄 때: 앞 4자 + … + 뒤 2자 */
export const mask = (v) => (!v ? '(없음)' : v.length <= 8 ? '****' : `${v.slice(0, 4)}…${v.slice(-2)}`);
