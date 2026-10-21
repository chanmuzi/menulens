// 메뉴판 챗 응답 시간 측정. 로컬 `pnpm dev`(5173) 가 떠 있어야 하고, playwright-core 가 설치된 디렉터리에서 실행한다.
// 사용법: node scripts/bench/chat_timing.mjs <메뉴판 이미지> [access_code]
// 결과: 글자만 / 처음부터 사진 / 글자 → [사진 필요] → 사진 세 경로의 답 시간
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const [img, codeArg] = process.argv.slice(2);
const code = codeArg ?? fs.readFileSync('.env', 'utf8').match(/^ACCESS_CODES=([^,\n]+)/m)?.[1]?.trim();
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto('http://localhost:5173/'); await p.fill('#code', code); await p.click('button[type=submit]'); await p.waitForSelector('text=앨범에서');
await p.setInputFiles('input[aria-label="앨범에서 선택"]', [img]); await p.waitForSelector('button.btn--primary:has-text("분석하기")'); await p.click('button.btn--primary:has-text("분석하기")');
await p.waitForSelector('button[aria-label="홈으로"]', { timeout: 120000 }); await p.waitForTimeout(500);
const dlg = p.locator('[role=dialog][aria-label="메뉴판에 물어보기"]');
const ask = async (label, q) => {
  const t = Date.now();
  if (q) { await dlg.locator('input[aria-label="질문"]').fill(q); await dlg.locator('button[aria-label="보내기"]').click(); } else await dlg.getByRole('button', { name: label }).click();
  for (let i = 0; i < 400; i++) { if (i > 2 && !(await dlg.locator('.blink').count())) break; await p.waitForTimeout(250); }
  console.log(`${label}: ${Date.now() - t}ms`);
};
await p.click('button[aria-label^="메뉴판에 물어보기"]'); await p.waitForSelector('[role=dialog][aria-label="메뉴판에 물어보기"]:not([hidden])');
await ask('대표 메뉴가 뭐야?');
await ask('내가 놓친 정보 있어?');
await ask('free', '영업 시간이나 라스트오더 적혀 있어?');
console.log('labels:', await dlg.locator('text=/사진을 다시 봤어요|글자만 보고 답함/').allTextContents());
await b.close();
