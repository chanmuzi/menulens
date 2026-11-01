#!/usr/bin/env node
/**
 * MenuLens 처음 세팅 마법사: pnpm bootstrap
 *   - 쓸 기능과 LLM 제공자를 묻고, 필요한 키만 터미널에서 받아(화면에 안 보임) 무료 조회 한 번으로 확인한 뒤 .env 에 쓴다
 *   - 원하면 Vercel 프로젝트 생성 → 환경변수 올리기 → GitHub 연결 → 첫 배포 → 스모크까지 한다(로그인은 직접)
 * 옵션: --check  질문 없이 지금 .env 의 키가 살아 있는지만 확인
 *       --env <경로>  .env 대신 다른 파일(기본 .env)
 *       --project <이름>  Vercel 프로젝트 이름(기본 menulens)
 *       --skip-vercel  Vercel 단계 건너뜀
 * 키 값은 어디에도 출력하지 않는다. 에이전트와 함께 쓰는 절차는 .claude/skills/menulens-setup/SKILL.md
 */
import { ask, choose, confirm, secret, closePrompt } from './prompt.mjs';
import { mask, readEnv, writeEnv } from './env.mjs';
import { checkRedis, effectiveProvider, FEATURES, KEYS, LLM_PROVIDERS, suggestCode } from './providers.mjs';
import * as vercel from './vercel.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ENV_PATH = opt('--env', '.env');
const PROJECT = opt('--project', 'menulens');

const h = (s) => console.log(`\n■ ${s}`);
const ok = (s) => console.log(`  ✓ ${s}`);
const bad = (s) => console.log(`  ✗ ${s}`);

const env = readEnv(ENV_PATH);

/** 키 하나를 받고 확인한다. 반환: 최종 값(빈 문자열이면 비움) */
const collectKey = async (name, { required }) => {
  const k = KEYS[name];
  console.log(`\n${k.label}  (${k.where})`);
  if (env[name]) console.log(`  지금 값: ${mask(env[name])}  (Enter 면 그대로 둠)`);
  else if (!required) console.log('  선택 항목입니다. 비워 두려면 Enter');
  for (let tries = 0; tries < 3; tries++) {
    const v = await secret(`  ${name} =`);
    const value = v || env[name] || '';
    if (!value) { if (required) { bad('필수 키입니다'); continue; } return ''; }
    process.stdout.write('  확인 중… ');
    const r = await k.validate(value).catch((e) => ({ ok: false, detail: e.message }));
    if (r.ok) { console.log('살아 있는 키입니다'); return value; }
    console.log(`실패: ${r.detail}`);
    if (!required && !(await confirm('  다시 입력할까요? (아니오면 비워 둠)'))) return '';
  }
  console.log('  3번 실패했습니다. 나중에 .env 에 직접 넣어도 됩니다.');
  return env[name] || '';
};

/** --check: 지금 .env 의 키가 전부 살아 있는지 */
const check = async () => {
  h(`${ENV_PATH} 의 키 확인`);
  let failed = 0;
  for (const name of Object.keys(KEYS)) {
    if (!env[name]) continue;
    const r = await KEYS[name].validate(env[name]).catch((e) => ({ ok: false, detail: e.message }));
    if (r.ok) ok(`${name} ${mask(env[name])}`); else { bad(`${name} ${mask(env[name])} ${r.detail}`); failed++; }
  }
  if (env.REDIS_URL) { const r = await checkRedis(env.REDIS_URL); if (r.ok) ok('REDIS_URL 연결됨'); else { bad(`REDIS_URL ${r.detail}`); failed++; } }
  // 서버(api/_lib/llm.ts)와 같은 규칙: LLM_PROVIDER 가 있으면 그것(키는 제공자 키 또는 LLM_API_KEY), 없으면 timely → anthropic → openai → upstage 순
  const provider = effectiveProvider(env);
  const providerEnv = LLM_PROVIDERS.find((p) => p.key === provider)?.env;
  if (provider && (env.LLM_API_KEY || !providerEnv || env[providerEnv])) ok(`LLM 제공자: ${provider}${env.LLM_PROVIDER ? '' : ' (LLM_PROVIDER 가 비어 있어 키가 있는 순서로 고른 값)'}`);
  else if (provider) { bad(`LLM_PROVIDER=${provider} 인데 ${providerEnv ?? 'LLM_API_KEY'} 가 없습니다`); failed++; }
  else { bad('LLM 키가 하나도 없습니다'); failed++; }
  if (!env.UPSTAGE_API_KEY) console.log('  ! UPSTAGE_API_KEY 가 없어 OCR 없이 이미지 폴백만 돕니다(느리고 비쌈)');
  console.log(env.ACCESS_CODES ? `  초대 코드 ${env.ACCESS_CODES.split(',').length}개 설정됨` : '  ! ACCESS_CODES 비어 있음: 로컬은 통과, 배포하면 전부 거부');
  return failed === 0;
};

const main = async () => {
  console.log('MenuLens 세팅을 시작합니다. 키 값은 화면에도 기록에도 남기지 않습니다. Ctrl+C 로 언제든 중단.');
  if (flag('--check')) { const good = await check(); closePrompt(); process.exit(good ? 0 : 1); }

  h('1/4 쓸 기능');
  const featureKey = await choose('어디까지 쓰실 건가요?', FEATURES, env.GROQ_API_KEY ? 'photo+talk' : 'photo');
  const feature = FEATURES.find((f) => f.key === featureKey);

  h('2/4 LLM 제공자');
  // 기본값은 서버가 실제로 고를 제공자(다시 실행해 Enter 만 눌러도 과금처가 바뀌지 않게)
  const current = effectiveProvider(env) || 'anthropic';
  const providerKey = await choose('번역·설명·챗에 쓸 모델 제공자는요?', LLM_PROVIDERS, current);
  const provider = LLM_PROVIDERS.find((p) => p.key === providerKey);

  h('3/4 API 키');
  const updates = { LLM_PROVIDER: provider.key };
  updates[provider.env] = await collectKey(provider.env, { required: true });
  for (const name of feature.keys.required) if (name !== provider.env) updates[name] = await collectKey(name, { required: name !== 'UPSTAGE_API_KEY' || !(await skipOcr()) });
  for (const name of feature.keys.optional) updates[name] = await collectKey(name, { required: false });

  console.log('\n초대 코드: 배포 주소에 아무나 들어와 내 키로 호출하지 못하게 막는 비밀 문구입니다(쉼표로 여러 개). 로컬에서만 쓰면 - 를 입력해 비워도 됩니다.');
  const codeDef = env.ACCESS_CODES || suggestCode();
  const codeIn = await ask('  ACCESS_CODES = (비우려면 -)', codeDef);
  updates.ACCESS_CODES = codeIn === '-' ? '' : codeIn;

  console.log('\nRedis(선택): 요리 설명과 생성 아이콘 캐시. Vercel Storage 에서 Redis 를 추가하면 배포 환경에는 자동으로 들어가니 지금은 비워도 됩니다.');
  const redis = await secret(`  REDIS_URL = ${env.REDIS_URL ? `(지금 ${mask(env.REDIS_URL)}, Enter 면 그대로)` : '(Enter 면 건너뜀)'}`);
  const redisValue = redis || env.REDIS_URL || '';
  if (redisValue) { const r = await checkRedis(redisValue); if (r.ok) { ok('Redis 연결됨'); updates.REDIS_URL = redisValue; } else { bad(`Redis 연결 실패: ${r.detail}. 비워 둡니다`); } }

  writeEnv(ENV_PATH, updates);
  h(`${ENV_PATH} 에 저장했습니다`);
  for (const [k, v] of Object.entries(updates)) console.log(`  ${k} = ${k === 'LLM_PROVIDER' ? v : k === 'ACCESS_CODES' ? (v ? `${v.split(',').length}개` : '(비움)') : mask(v)}`);
  console.log('\n로컬 실행: pnpm install && pnpm dev  →  http://localhost:5173  (같은 Wi-Fi 의 휴대폰은 터미널의 Network 주소)');

  h('4/4 Vercel 배포');
  if (flag('--skip-vercel') || !(await confirm('지금 Vercel 에 배포할까요? (계정이 없으면 https://vercel.com 에서 GitHub 로 가입 후 다시 실행)'))) { done(); return; }
  if (!vercel.cliOk()) { bad('Vercel CLI 를 실행하지 못했습니다(npx vercel). Node 22 와 네트워크를 확인해 주세요'); done(); return; }
  const who = vercel.whoami();
  if (!who) { bad('Vercel 에 로그인돼 있지 않습니다. 터미널에서  npx vercel login  을 마친 뒤  pnpm bootstrap  을 다시 실행해 주세요(입력한 값은 유지됩니다)'); done(); return; }
  ok(`Vercel 계정: ${who}`);
  const name = await ask('  프로젝트 이름:', PROJECT);
  process.stdout.write('  프로젝트 만들고 연결 중… ');
  const p = vercel.ensureProject(name);
  if (!p.ok) { console.log(`실패: ${p.detail}`); done(); return; }
  console.log('연결했습니다(없으면 새로 만듦)');
  console.log('  Production 환경변수 올리는 중');
  const failed = vercel.pushEnv({ ...updates, ...(updates.REDIS_URL ? {} : { REDIS_URL: '' }) });
  if (failed.length) failed.forEach((f) => bad(f));
  if (!updates.ACCESS_CODES) bad('ACCESS_CODES 가 비어 있어 배포 환경에서는 모든 요청이 거부됩니다. Vercel 대시보드에서 넣어 주세요');
  console.log('  GitHub 저장소 연결(main 에 push 하면 자동 배포). 안 되면 대시보드 Settings → Git 에서 연결하면 됩니다');
  vercel.gitConnect();
  console.log('  첫 배포 중(1~2분)…');
  const d = vercel.deployProd();
  if (!d.ok) { bad(`배포 실패: ${d.detail}`); done(); return; }
  const url = d.url;
  const s = await vercel.smoke(url, (updates.ACCESS_CODES || '').split(',')[0]);
  h('배포 확인');
  console.log(`  주소: ${url}`);
  console.log(`  /api/rate → ${s.rate}   /api/auth(초대 코드) → ${s.auth}   (둘 다 200 이면 정상)`);
  console.log('\n휴대폰 브라우저로 위 주소를 열고 초대 코드를 넣은 뒤 「홈 화면에 추가」하면 앱처럼 씁니다.');
  console.log('다른 사람에게 코드를 나눠 주기 전에 DEBUG_STORE 는 비워 두세요(켜면 사진이 7일간 Redis 에 남습니다).');
  done();
};

/** Upstage 키가 LLM 키가 아닐 때, OCR 을 건너뛸지 */
const skipOcr = async () => {
  if (env.UPSTAGE_API_KEY) return false;
  console.log('\nUpstage Document OCR 키가 없으면 모든 사진을 모델이 직접 읽는 폴백으로만 돌아 느리고 비쌉니다. 무료 크레딧으로 충분하니 받는 것을 권합니다.');
  return !(await confirm('  Upstage 키를 지금 넣을까요?'));
};

const done = () => { console.log('\n끝. 다시 실행하면 지금 값을 보여 주고 바꿀 것만 묻습니다. 확인만 하려면  pnpm bootstrap --check'); closePrompt(); };

main().catch((e) => { console.error('\n오류:', e.message); closePrompt(); process.exit(1); });
