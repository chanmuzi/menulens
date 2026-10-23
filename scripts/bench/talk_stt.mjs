// 대화 통역 음성 인식 측정. macOS `say` 합성 음성(한국어 Yuna·일본어 Kyoko)으로 예문을 m4a 로 만들어 Groq·Gemini 에 보낸다.
// 사용법: node scripts/bench/talk_stt.mjs [groq|gemini|both]   (.env 의 GROQ_API_KEY·GEMINI_API_KEY 사용, 산출 음성은 OS 임시 폴더)
// 결과: 모델별 응답 ms, 글자 오류율(CER, 공백·문장부호 제외), 받아 적은 문장. 무음 3초 파일로 없는 말 지어내기도 본다.
// 주의: Gemini 무료 등급 받아쓰기 모델은 분당 3회라 gemini 는 21초 간격으로 보낸다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const which = process.argv[2] ?? 'groq';
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'talk-stt-'));
const LINES = [
  ['ko1', 'Yuna', '돈코츠 라멘 하나랑 교자 하나 주세요. 면은 조금 단단하게 해 주세요'],
  ['ko2', 'Yuna', '어제부터 목이 아프고 열이 조금 있어요. 졸리지 않는 감기약 있을까요?'],
  ['ko3', 'Yuna', '계산은 카드로 할 수 있나요?'],
  ['ja1', 'Kyoko', 'スープは辛くないですよ。卓上の辛子高菜は辛いので、お好みでどうぞ'],
  ['ja2', 'Kyoko', '申し訳ございません、ただいま満席でして、カウンターでしたら二十分ほどでご案内できます'],
  ['ja3', 'Kyoko', '眠くなりにくいタイプでしたらこちらですね。一日三回、食後に二錠ずつ飲んでください'],
];
for (const [id, voice, text] of LINES) {
  const aiff = path.join(dir, `${id}.aiff`);
  execFileSync('say', ['-v', voice, '-o', aiff, text]);
  execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', aiff, path.join(dir, `${id}.m4a`)]);
}
// 무음 3초(아주 작은 잡음)
const wav = path.join(dir, 'silence.wav');
const n = 44100 * 3, buf = Buffer.alloc(44 + n * 2);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(44100, 24); buf.writeUInt32LE(88200, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round((Math.random() - 0.5) * 60), 44 + i * 2);
fs.writeFileSync(wav, buf);
execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', wav, path.join(dir, 'silence.m4a')]);

const norm = (s) => s.replace(/[\s、。，,.?？!！]/g, '');
const cer = (a, b) => { a = norm(a); b = norm(b); const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length] / a.length; };
const cases = [...LINES.map(([id, , text]) => [id, text]), ['silence', '']];

const groq = async (file, lang) => {
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(file)], { type: 'audio/mp4' }), 'a.m4a');
  fd.append('model', 'whisper-large-v3-turbo'); fd.append('language', lang); fd.append('temperature', '0');
  const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${env.GROQ_API_KEY}` }, body: fd });
  const limits = ['x-ratelimit-limit-requests', 'x-ratelimit-limit-audio-seconds'].map((k) => `${k.replace('x-ratelimit-limit-', '')}=${r.headers.get(k)}`).join(' ');
  return { status: r.status, text: r.ok ? (await r.json()).text : (await r.text()).slice(0, 160), limits };
};
const gemini = async (file, lang) => {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'gemini-3.5-transcribe', input: [{ type: 'audio', data: fs.readFileSync(file).toString('base64'), mime_type: 'audio/mp4' }], generation_config: { transcription_config: { language_codes: [lang === 'ko' ? 'ko-KR' : 'ja-JP'] } } }),
  });
  const body = await r.text();
  if (!r.ok) return { status: r.status, text: body.slice(0, 160), limits: '' };
  const j = JSON.parse(body);
  return { status: r.status, text: typeof j.output_text === 'string' ? j.output_text : JSON.stringify(j.outputs ?? j).slice(0, 300), limits: '' };
};

for (const [name, fn] of [['groq', groq], ['gemini', gemini]]) {
  if (which !== 'both' && which !== name) continue;
  for (const [id, ref] of cases) {
    const t0 = Date.now();
    const r = await fn(path.join(dir, `${id}.m4a`), id.startsWith('ja') ? 'ja' : 'ko');
    const ms = Date.now() - t0;
    console.log([name, id, r.status, `${ms}ms`, ref ? `CER ${(cer(ref, r.text) * 100).toFixed(0)}%` : '무음', r.text.trim(), r.limits].join(' | '));
    if (name === 'gemini') await new Promise((res) => setTimeout(res, 21000));
  }
}
fs.rmSync(dir, { recursive: true, force: true });
