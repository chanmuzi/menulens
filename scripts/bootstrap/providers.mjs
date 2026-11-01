// 어떤 기능에 어떤 키가 필요한지, 키는 어디서 받는지, 살아 있는 키인지 확인하는 방법. 확인은 전부 무료 조회(모델 목록) 한 번이다.
import net from 'node:net';
import tls from 'node:tls';

/** LLM 제공자(표시 순서: 권장이 먼저). 이름과 키 환경변수는 api/_lib/llm.ts 의 PRESETS 와 같아야 한다(scripts/bench/bootstrap_test.ts). 모델은 런타임이 정하므로 여기 두지 않는다 */
export const LLM_PROVIDERS = [
  { key: 'anthropic', label: 'Anthropic (Claude Sonnet, 권장: 키 하나로 전 기능)', env: 'ANTHROPIC_API_KEY' },
  { key: 'openai', label: 'OpenAI (gpt-5.4-mini)', env: 'OPENAI_API_KEY' },
  { key: 'upstage', label: 'Upstage Solar (OCR 과 같은 키 하나. 글자 없는 사진은 못 읽음)', env: 'UPSTAGE_API_KEY' },
  { key: 'timely', label: 'Timely Router (Anthropic 호환 라우터)', env: 'TIMELY_API_KEY' },
];
/** LLM_PROVIDER 가 비었을 때 서버가 고르는 순서. api/_lib/llm.ts 의 AUTO_ORDER 와 같아야 한다 */
export const AUTO_ORDER = ['timely', 'anthropic', 'openai', 'upstage'];
/** 서버와 같은 규칙으로 지금 .env 가 쓰게 될 제공자. 없으면 null */
export const effectiveProvider = (env) => env.LLM_PROVIDER || AUTO_ORDER.find((k) => env[LLM_PROVIDERS.find((p) => p.key === k).env]) || null;

const bearer = (url) => async (key) => status(await fetch(url, { headers: { authorization: `Bearer ${key}` } }));
const status = (res) => (res.ok ? { ok: true } : { ok: false, detail: `HTTP ${res.status}${res.status === 401 || res.status === 403 ? ' (키가 틀렸거나 권한 없음)' : ''}` });

/** 키 정의. required 는 기능 선택에 따라 index.mjs 가 정한다 */
export const KEYS = {
  ANTHROPIC_API_KEY: { label: 'Anthropic API 키', where: 'https://console.anthropic.com → API Keys', hint: 'sk-ant-…', validate: async (k) => status(await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' } })) },
  OPENAI_API_KEY: { label: 'OpenAI API 키', where: 'https://platform.openai.com/api-keys', hint: 'sk-…', validate: bearer('https://api.openai.com/v1/models') },
  UPSTAGE_API_KEY: { label: 'Upstage API 키 (Document OCR, Solar)', where: 'https://console.upstage.ai → API Keys', hint: 'up_…', validate: bearer('https://api.upstage.ai/v1/models') },
  TIMELY_API_KEY: { label: 'Timely Router API 키', where: 'https://timelyrouter.ai (로그인 후 키 발급)', hint: 'tk_…', validate: bearer('https://api.timelyrouter.ai/v1/models') },
  GROQ_API_KEY: { label: 'Groq API 키 (음성 인식 Whisper, 무료 등급)', where: 'https://console.groq.com/keys', hint: 'gsk_…', validate: bearer('https://api.groq.com/openai/v1/models') },
  GEMINI_API_KEY: { label: 'Gemini API 키 (음성 인식 예비, 선택)', where: 'https://aistudio.google.com/apikey', hint: 'AIza…', validate: async (k) => status(await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(k)}`)) },
};

/** 기능 묶음 → 필요한 키. LLM 제공자 키는 따로 더한다 */
export const FEATURES = [
  { key: 'photo', label: '사진 읽기만 (메뉴판·안내문 번역, 주문서, 챗)', keys: { required: ['UPSTAGE_API_KEY'], optional: [] } },
  { key: 'photo+talk', label: '사진 읽기 + 대화 통역 (음성 인식)', keys: { required: ['UPSTAGE_API_KEY', 'GROQ_API_KEY'], optional: ['GEMINI_API_KEY'] } },
];

/** Redis 연결 확인: AUTH 뒤 PING. 표준 라이브러리 RESP */
export const checkRedis = (url) => new Promise((resolve) => {
  let u;
  try { u = new URL(url); } catch { resolve({ ok: false, detail: '주소 형식이 아닙니다 (redis://user:pass@host:port)' }); return; }
  const port = Number(u.port || 6379);
  const sock = u.protocol === 'rediss:' ? tls.connect({ host: u.hostname, port, servername: u.hostname }) : net.connect({ host: u.hostname, port });
  const done = (r) => { try { sock.destroy(); } catch { /* 이미 닫힘 */ } resolve(r); };
  const t = setTimeout(() => done({ ok: false, detail: '10초 안에 응답이 없습니다' }), 10000);
  const cmd = (...a) => `*${a.length}\r\n${a.map((x) => `$${Buffer.byteLength(x)}\r\n${x}\r\n`).join('')}`;
  let buf = '';
  sock.on('error', (e) => { clearTimeout(t); done({ ok: false, detail: e.message }); });
  sock.on('connect', () => { sock.write((u.password ? cmd('AUTH', decodeURIComponent(u.username || 'default'), decodeURIComponent(u.password)) : '') + cmd('PING')); });
  sock.on('secureConnect', () => { sock.write((u.password ? cmd('AUTH', decodeURIComponent(u.username || 'default'), decodeURIComponent(u.password)) : '') + cmd('PING')); });
  sock.on('data', (d) => {
    buf += d.toString();
    if (buf.includes('+PONG')) { clearTimeout(t); done({ ok: true }); }
    else if (buf.startsWith('-')) { clearTimeout(t); done({ ok: false, detail: buf.split('\r\n')[0] }); }
  });
});

/** 초대 코드 후보: 읽기 쉬운 소문자 + 숫자 (저장소에 보이는 단어는 피한다) */
export const suggestCode = () => {
  const words = ['yuzu', 'momiji', 'tsuki', 'kumo', 'sora', 'hana', 'kawa', 'yama', 'umi', 'hoshi', 'mori', 'kaze'];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}-${Math.floor(1000 + Math.random() * 9000)}`;
};
