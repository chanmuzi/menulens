#!/usr/bin/env node
/**
 * 배포 스모크: 함수 8개를 전부 쳐서 표로 보여 준다. 하나라도 실패하면 종료 코드 1.
 *   node scripts/bench/smoke.mjs <주소> [--image <사진>] [--code <초대 코드>]
 * 초대 코드는 --code 가 없으면 .env 의 ACCESS_CODES 첫 값(값은 출력하지 않는다). 사진이 없으면 scripts/bench/make_menu_tilted.py 로 합성한다(Pillow 필요).
 * 음성 인식은 macOS `say`·`afconvert` 가 있을 때만 합성 음성으로 친다(없으면 건너뜀으로 표시).
 * LLM 을 부르는 항목(analyze·chat·talk·icon)은 각각 한 번씩만 호출한다(소액 과금).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const base = (args.find((a) => a.startsWith('http')) ?? '').replace(/\/$/, '');
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!base) { console.error('사용: node scripts/bench/smoke.mjs <주소> [--image <사진>] [--code <초대 코드>]'); process.exit(2); }

const envCode = () => {
  try { return (/^ACCESS_CODES=\s*"?([^",\n]+)/m.exec(fs.readFileSync('.env', 'utf8')) ?? [])[1] ?? ''; } catch { return ''; }
};
const code = opt('--code') ?? envCode();
const H = { 'content-type': 'application/json', 'x-access-code': code };
const rows = [];
const add = (name, ok, detail = '') => rows.push({ name, ok, detail });
const timed = async (fn) => { const t = performance.now(); const r = await fn(); return { r, ms: Math.round(performance.now() - t) }; };
const ndjson = async (res, onEv) => {
  const r = res.body.getReader(); const d = new TextDecoder(); let p = '';
  for (;;) { const { done, value } = await r.read(); if (done) break; p += d.decode(value, { stream: true }); const ls = p.split('\n'); p = ls.pop() ?? ''; for (const l of ls) if (l.trim()) onEv(JSON.parse(l)); }
  if (p.trim()) onEv(JSON.parse(p));
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'menulens-smoke-'));
const imagePath = () => {
  const given = opt('--image');
  if (given) return given;
  const out = path.join(tmp, 'menu.png');
  try { execFileSync('python3', ['-I', 'scripts/bench/make_menu_tilted.py', out], { stdio: 'ignore' }); return out; } catch { return null; }
};
const audioPath = () => {
  if (process.platform !== 'darwin') return null;
  try {
    const aiff = path.join(tmp, 'a.aiff'); const m4a = path.join(tmp, 'a.m4a');
    execFileSync('say', ['-v', 'Yuna', '-o', aiff, '화장실이 어디예요'], { stdio: 'ignore' });
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '64000', aiff, m4a], { stdio: 'ignore' });
    return m4a;
  } catch { return null; }
};

// 1. 앱 셸과 버전
try { const { r, ms } = await timed(() => fetch(`${base}/`)); add('/ (앱 셸)', r.status === 200, `${r.status} ${ms}ms`); } catch (e) { add('/ (앱 셸)', false, String(e)); }
try { const r = await fetch(`${base}/version.json`); const j = await r.json().catch(() => ({})); add('/version.json', r.status === 200 && !!j.id, `${r.status} id=${j.id ?? '-'}`); } catch (e) { add('/version.json', false, String(e)); }
// 2. auth
try { const bad = await fetch(`${base}/api/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'wrong-code-xyz' }) }); add('auth 틀린 코드 → 401', bad.status === 401, String(bad.status)); } catch (e) { add('auth 틀린 코드 → 401', false, String(e)); }
try { const good = await fetch(`${base}/api/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) }); add('auth 초대 코드 → 200', good.status === 200, code ? String(good.status) : '코드 없음(.env ACCESS_CODES 또는 --code)'); } catch (e) { add('auth 초대 코드 → 200', false, String(e)); }
// 3. rate
try { const r = await fetch(`${base}/api/rate`); const j = await r.json().catch(() => ({})); add('rate 환율', r.status === 200 && typeof j.krwPerJpy === 'number', `${r.status} krwPerJpy=${j.krwPerJpy ?? '-'}`); } catch (e) { add('rate 환율', false, String(e)); }
// 4. analyze
const img = imagePath();
let items = [];
if (!img) add('analyze 메뉴판', false, '테스트 사진 없음(--image 또는 Pillow)');
else {
  try {
    const { r, ms } = await timed(async () => {
      const res = await fetch(`${base}/api/analyze`, { method: 'POST', headers: H, body: JSON.stringify({ image: fs.readFileSync(img).toString('base64'), mediaType: 'image/png', lang: 'ko' }) });
      if (!res.ok) return { status: res.status };
      const s = { items: 0, details: 0, groups: 0, done: false, error: null, mode: null };
      await ndjson(res, (ev) => { if (ev.t === 'item') { s.items++; items.push(ev.item); } if (ev.t === 'details') s.details += ev.items.length; if (ev.t === 'groups') s.groups = ev.groups.length; if (ev.t === 'done') s.done = true; if (ev.t === 'error') s.error = ev.m; if (ev.t === 'mode') s.mode = ev.mode; });
      return { status: 200, ...s };
    });
    add('analyze 메뉴판', r.status === 200 && r.done && r.items > 0 && !r.error, r.status === 200 ? `${r.mode} 항목 ${r.items} 설명 ${r.details} 묶음 ${r.groups} ${ms}ms${r.error ? ' 오류 ' + r.error : ''}` : `HTTP ${r.status}`);
  } catch (e) { add('analyze 메뉴판', false, String(e)); }
}
// 5. chat (글자만)
try {
  const ctx = items.slice(0, 10).map((it, i) => ({ k: `0:${i}`, src: it.name ?? '', tr: it.tr ?? '', price: it.price ?? null, desc: '', group: null }));
  const { r, ms } = await timed(async () => {
    const res = await fetch(`${base}/api/chat`, { method: 'POST', headers: H, body: JSON.stringify({ kind: 'menu', photos: 1, lang: { src: 'ja', dst: 'ko' }, items: ctx, notes: [], question: '가장 싼 메뉴는?', history: [] }) });
    if (!res.ok) return { status: res.status };
    let text = ''; let done = false; let err = null;
    await ndjson(res, (ev) => { if (ev.t === 'delta') text += ev.text; if (ev.t === 'done') done = true; if (ev.t === 'error') err = ev.m; });
    return { status: 200, text, done, err };
  });
  add('chat 질문', r.status === 200 && r.done && r.text.length > 0 && !r.err, r.status === 200 ? `${r.text.slice(0, 30)}… ${ms}ms` : `HTTP ${r.status}`);
} catch (e) { add('chat 질문', false, String(e)); }
// 6. talk translate
try {
  const { r, ms } = await timed(async () => {
    const res = await fetch(`${base}/api/talk`, { method: 'POST', headers: H, body: JSON.stringify({ mode: 'translate', text: '물 좀 주세요', turns: [], lang: { me: 'ko' } }) });
    if (!res.ok) return { status: res.status };
    let done = null; let err = null;
    await ndjson(res, (ev) => { if (ev.t === 'done') done = ev; if (ev.t === 'error') err = ev.m; });
    return { status: 200, done, err };
  });
  add('talk 번역', r.status === 200 && !!r.done?.result?.ja && !r.err, r.status === 200 ? `${r.done?.result?.ja ?? '-'} via=${r.done?.via ?? '-'} ${ms}ms` : `HTTP ${r.status}`);
} catch (e) { add('talk 번역', false, String(e)); }
// 7. stt
const m4a = audioPath();
if (!m4a) add('stt 음성 인식', null, 'macOS say 없음 → 건너뜀(실기기로 확인)');
else {
  try {
    const { r, ms } = await timed(() => fetch(`${base}/api/stt`, { method: 'POST', headers: { 'content-type': 'audio/mp4', 'x-lang': 'ko', 'x-access-code': code }, body: fs.readFileSync(m4a) }));
    const j = await r.json().catch(() => ({}));
    add('stt 음성 인식', r.status === 200 && typeof j.text === 'string', `${r.status} ${j.text ? `「${j.text}」 via=${j.via}` : JSON.stringify(j).slice(0, 60)} ${ms}ms`);
  } catch (e) { add('stt 음성 인식', false, String(e)); }
}
// 8. icon (캐시를 피하려고 매번 다른 이름)
try {
  const name = `스모크꼬치${Date.now() % 100000}`;
  const { r, ms } = await timed(() => fetch(`${base}/api/icon`, { method: 'POST', headers: H, body: JSON.stringify({ items: [{ name, tr: '닭꼬치', hint: 'yakitori' }] }) }));
  const j = await r.json().catch(() => ({}));
  add('icon 생성', r.status === 200 && (Object.keys(j.icons ?? {}).length === 1 || (j.failed ?? []).length === 1), `${r.status} 생성 ${Object.keys(j.icons ?? {}).length} 실패 ${(j.failed ?? []).length} ${ms}ms`);
} catch (e) { add('icon 생성', false, String(e)); }

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n스모크 ${base}`);
for (const r of rows) console.log(`  ${r.ok === null ? '－' : r.ok ? '✓' : '✗'} ${r.name.padEnd(22)} ${r.detail}`);
const failed = rows.filter((r) => r.ok === false);
console.log(failed.length ? `\n실패 ${failed.length}건` : '\n모두 통과');
process.exit(failed.length ? 1 : 0);
