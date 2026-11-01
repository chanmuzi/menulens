// Vercel CLI(npx vercel)로 프로젝트 만들기 → 환경변수 올리기 → GitHub 연결 → 첫 배포 → 스모크. 로그인은 사용자가 직접 한다.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

/** CLI 배너·npm 경고·TLS 경고 같은 잡음 줄 */
const NOISE = /NODE_TLS_REJECT_UNAUTHORIZED|trace-warnings|^npm warn|^Vercel CLI \d|^\s*$/;
const clean = (s) => (s ?? '').split('\n').filter((l) => !NOISE.test(l)).join('\n').trim();

const run = (args, { input, quiet } = {}) => {
  const r = spawnSync('npx', ['vercel', ...args], { encoding: 'utf8', input, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  const stdout = clean(r.stdout);
  const out = clean(`${r.stdout ?? ''}\n${r.stderr ?? ''}`);
  if (!quiet && out) console.log(out.split('\n').map((l) => '    ' + l).join('\n'));
  return { status: r.status ?? 1, out, stdout };
};

export const cliOk = () => run(['--version'], { quiet: true }).status === 0;

/** 로그인한 계정 이름, 아니면 null */
export const whoami = () => { const r = run(['whoami'], { quiet: true }); const name = r.stdout.split('\n').pop()?.trim(); return r.status === 0 && name ? name : null; };

/** 프로젝트가 없으면 만들고 이 폴더를 연결한다(.vercel/ 생성). link 가 .gitignore 끝에 `.env*` 를 덧붙여 `.env.example` 까지 무시하게 만들므로 원래대로 돌린다(저장소는 이미 .env 와 .vercel 을 무시한다) */
export const ensureProject = (name) => {
  const add = run(['project', 'add', name], { quiet: true });
  if (add.status !== 0 && !/already exists|이미/.test(add.out)) return { ok: false, detail: add.out };
  const ignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf8') : null;
  const link = run(['link', '--yes', '--project', name], { quiet: true });
  if (ignore !== null && fs.readFileSync('.gitignore', 'utf8') !== ignore) fs.writeFileSync('.gitignore', ignore);
  return link.status === 0 ? { ok: true } : { ok: false, detail: link.out };
};

/** .env 의 값을 Production 환경변수로. 값은 stdin 으로 넘겨 화면·셸 기록에 남지 않는다 */
export const pushEnv = (vars) => {
  const failed = [];
  for (const [k, v] of Object.entries(vars)) {
    if (!v) continue;
    const r = run(['env', 'add', k, 'production', '--force'], { input: v, quiet: true });
    if (r.status !== 0) failed.push(`${k}: ${r.out.split('\n').pop()}`);
    else console.log(`    ${k} 올림`);
  }
  return failed;
};

/** GitHub 저장소 연결(main push = 배포). 실패해도 배포는 할 수 있으니 안내만 한다 */
export const gitConnect = () => {
  const r = run(['git', 'connect', '--yes'], { quiet: true });
  const last = r.out.split('\n').filter((l) => /Connect|connect|Error|error/.test(l)).pop() ?? r.out.split('\n').pop() ?? '';
  console.log(`    ${last.replace(/^>\s*/, '')}`);
  return r.status === 0;
};

/** 첫 프로덕션 배포. CLI 가 파이프에서는 JSON 을 내므로 productionUrl 을 읽고, 아니면 출력의 마지막 .vercel.app 주소 */
export const deployProd = () => {
  const r = run(['deploy', '--prod', '--yes'], { quiet: true });
  let url = null;
  try { const j = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))); url = j.deployment?.productionUrl ?? j.deployment?.url ?? null; } catch { /* JSON 이 아니면 아래 */ }
  url ??= (r.out.match(/https:\/\/[^\s"]+\.vercel\.app/g) ?? []).pop() ?? null;
  return r.status === 0 && url ? { ok: true, url } : { ok: false, detail: r.out.split('\n').slice(-3).join(' ') };
};

/** 배포 뒤 확인: 환율 API 200, 초대 코드 200. 프로덕션 도메인은 배포 직후 잠시 404 라 최대 1분 기다린다 */
export const smoke = async (base, code) => {
  const probe = async () => {
    const out = {};
    try { out.rate = (await fetch(`${base}/api/rate`)).status; } catch (e) { out.rate = String(e); }
    try { out.auth = (await fetch(`${base}/api/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })).status; } catch (e) { out.auth = String(e); }
    return out;
  };
  for (let i = 0; i < 6; i++) {
    const out = await probe();
    if (out.rate !== 404) return out;
    await new Promise((r) => setTimeout(r, 10000));
  }
  return probe();
};
