// 아이콘 매칭 전수 조사: 진단 저장소에서 내려받은 스캔(debug_pull.py 결과 디렉터리)의 모든 항목에
// resolveIcon 을 돌려 「카테고리 · 모델 선택 · 최종 아이콘 · 원문 · 한국어」 표를 TSV 로 찍는다.
// 사용: node --experimental-strip-types scripts/bench/icon_audit.mjs <scratchpad>/debug_scans > table.tsv
// 두 번 찍어 diff 하면 규칙 변경으로 바뀐 항목만 볼 수 있다. 결과 파일은 저장소에 넣지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { ICON_KEYS, resolveIcon } from '../../src/lib/icons.ts';
import { ICON_KEYS as SERVER_KEYS } from '../../api/_lib/prompt.ts';

const dir = process.argv[2];
if (!dir) { console.error('usage: icon_audit.mjs <debug_scans dir>'); process.exit(1); }
// 서버(프롬프트)와 클라이언트 아이콘 목록이 어긋나면 조용히 품질만 떨어지므로 여기서 경고한다
const onlyServer = SERVER_KEYS.filter((k) => !ICON_KEYS.has(k));
const onlyClient = [...ICON_KEYS].filter((k) => !SERVER_KEYS.includes(k));
if (onlyServer.length || onlyClient.length) console.error(`ICON_KEYS 불일치 — 서버에만: ${onlyServer.join(',') || '-'} / 클라이언트에만: ${onlyClient.join(',') || '-'}`);
const seen = new Map();
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const it of d.items ?? []) {
    if (seen.has(it.name_ja)) continue;
    seen.set(it.name_ja, [f.slice(0, 13), it.category, it.icon, resolveIcon(it.name_ja, it.icon, it.category), it.name_ja, it.name_ko]);
  }
}
console.log(['scan', 'category', 'model', 'icon', 'name_ja', 'name_ko'].join('\t'));
for (const r of seen.values()) console.log(r.join('\t'));
