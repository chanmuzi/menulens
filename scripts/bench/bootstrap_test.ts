// 마법사(scripts/bootstrap/providers.mjs)의 제공자 표가 서버(api/_lib/llm.ts)의 프리셋과 어긋나지 않는지.
// 실행: node --experimental-strip-types --import ./scripts/bench/register-ts.mjs --test scripts/bench/bootstrap_test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTO_ORDER, PRESETS } from '../../api/_lib/llm.ts';
import { AUTO_ORDER as WIZARD_ORDER, LLM_PROVIDERS, effectiveProvider } from '../bootstrap/providers.mjs';

test('마법사의 제공자 이름과 키 환경변수는 서버 프리셋과 같다', () => {
  for (const p of LLM_PROVIDERS as Array<{ key: keyof typeof PRESETS; env: string }>) {
    assert.ok(p.key in PRESETS, `${p.key} 는 서버 프리셋에 없다`);
    assert.equal(p.env, PRESETS[p.key].keyEnv, `${p.key} 의 키 환경변수`);
  }
});

test('자동 선택 순서가 서버와 같고, 표의 제공자를 모두 담는다', () => {
  assert.deepEqual(WIZARD_ORDER, AUTO_ORDER);
  assert.deepEqual([...WIZARD_ORDER].sort(), (LLM_PROVIDERS as Array<{ key: string }>).map((p) => p.key).sort());
});

test('effectiveProvider 는 서버와 같은 규칙으로 고른다', () => {
  assert.equal(effectiveProvider({ TIMELY_API_KEY: 'a', ANTHROPIC_API_KEY: 'b' }), 'timely');
  assert.equal(effectiveProvider({ ANTHROPIC_API_KEY: 'b', OPENAI_API_KEY: 'c' }), 'anthropic');
  assert.equal(effectiveProvider({ LLM_PROVIDER: 'upstage', ANTHROPIC_API_KEY: 'b' }), 'upstage');
  assert.equal(effectiveProvider({}), null);
});
