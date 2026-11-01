// 터미널 질문 도우미. 표준 라이브러리만 쓴다. stdin 이 파이프여도(답을 흘려 넣는 테스트) 동작한다.
// 입력은 readline 하나만 읽는다(raw 모드를 따로 켜면 같은 글자를 두 번 읽어 흐름이 꼬인다). 비밀 입력은 readline 의 화면 출력만 막는다.
import readline from 'node:readline';

const tty = Boolean(process.stdin.isTTY);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: tty, prompt: '' });
const lines = [];
const waiters = [];
let muted = false;
// terminal 모드에서 readline 이 입력을 화면에 되비추는 유일한 통로. 비밀 입력 동안 막는다
const write = rl._writeToOutput?.bind(rl);
if (write) rl._writeToOutput = (s) => { if (!muted) write(s); };
rl.on('line', (l) => { const w = waiters.shift(); if (w) w(l); else lines.push(l); });
rl.on('close', () => { for (const w of waiters.splice(0)) w(null); });
rl.on('SIGINT', () => { process.stdout.write('\n중단했습니다.\n'); process.exit(130); });

const nextLine = () => new Promise((resolve) => { if (lines.length) resolve(lines.shift()); else waiters.push(resolve); })
  .then((l) => { if (l === null) { console.log('\n입력이 끝나 중단합니다. 지금까지 확인한 값은 저장되지 않았습니다.'); process.exit(1); } return l; });

/** 한 줄 질문. 빈 입력이면 기본값. 이 질문부터는 입력을 다시 보여 준다 */
export const ask = async (q, def = '') => {
  muted = false;
  process.stdout.write(def ? `${q} [${def}] ` : `${q} `);
  const l = await nextLine();
  return l.trim() || def;
};

/** 번호 선택. options: [{ key, label }] */
export const choose = async (q, options, defKey) => {
  console.log(q);
  options.forEach((o, i) => console.log(`  ${i + 1}) ${o.label}${o.key === defKey ? '  (기본)' : ''}`));
  for (;;) {
    const a = await ask('번호:', String(options.findIndex((o) => o.key === defKey) + 1 || 1));
    const n = Number(a);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].key;
    const byKey = options.find((o) => o.key === a);
    if (byKey) return byKey.key;
    console.log('  1 부터', options.length, '사이 번호를 입력해 주세요');
  }
};

/** 예/아니오 */
export const confirm = async (q, def = true) => {
  const a = (await ask(`${q} (${def ? 'Y/n' : 'y/N'})`, def ? 'y' : 'n')).toLowerCase();
  return a.startsWith('y') || a === 'ㅇ' || a === '예';
};

/**
 * 비밀 입력. 터미널이면 글자를 화면에 찍지 않는다(붙여넣기·백스페이스는 readline 이 처리). 파이프면 그냥 한 줄 읽는다.
 * 숨김은 다음 일반 질문(ask)이 뜰 때까지 유지한다: 확인 중에 다음 키를 미리 붙여 넣어도 화면에 남지 않게
 */
export const secret = async (q) => {
  process.stdout.write(`${q} `);
  muted = tty;
  try { return (await nextLine()).trim(); } finally { if (tty) process.stdout.write('\n'); }
};

export const closePrompt = () => rl.close();
