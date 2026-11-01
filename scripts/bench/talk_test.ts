/**
 * 대화 통역의 규칙 발음과 「말해 볼 문장」 줄 처리 검사(api/_lib/talkPron.ts, sayLine.ts). 모델이 발음을 짓지 않는 경로를 고정한다.
 * 실행: node --experimental-strip-types --import ./scripts/bench/register-ts.mjs --test scripts/bench/talk_test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanKana, pronOf, sayWithPron, stripSayPron } from '../../api/_lib/talkPron.ts';
import { parseSay } from '../../api/_lib/sayLine.ts';
import { kanaToHangul } from '../../api/_lib/kanaToHangul.ts';
import { hangulToKana } from '../../api/_lib/hangulToKana.ts';

const KO_JA = { me: 'ko', them: 'ja' } as const;
const JA_KO = { me: 'ja', them: 'ko' } as const;

test('상대가 일본어: 읽기 → 한글(조사·문장부호·숫자)', () => {
  assert.equal(pronOf(KO_JA, 'トイレはどこですか？', 'といれは どこですか？'), '토이레와 도코데스카');
  assert.equal(pronOf(KO_JA, '', 'といれ は どこ ですか'), '토이레 와 도코 데스카', '홀로 선 조사도');
  assert.equal(pronOf(KO_JA, '', 'えき へ いきたいです'), '에키 에 이키타이데스');
  assert.equal(pronOf(KO_JA, '', 'わかりました〜'), '와카리마시타');
  assert.equal(pronOf(KO_JA, '', 'すみません、おみず ください。'), '스미마센 오미즈 쿠다사이');
  assert.equal(pronOf(KO_JA, '', 'こんにちは'), '콘니치와');
  assert.equal(pronOf(KO_JA, '', 'はい'), '하이');
  assert.equal(pronOf(KO_JA, '', 'コーヒー2つ'), '', '숫자·한자가 남으면 비운다(프롬프트가 읽기로 적게 한다)');
  assert.equal(cleanKana('（はい）！'), ' はい  ');
  assert.equal(kanaToHangul('おかゆは'), '오카유하', '메뉴 이름 경로는 조사 규칙 없음');
});

test('상대가 한국어: 문장 → 가타카나(괄호는 읽지 않는다, 겹받침 ㅎ 탈락)', () => {
  assert.equal(pronOf(JA_KO, '이거 (하나) 주세요', ''), 'イゴ ハナ チュセヨ');
  assert.equal(pronOf(JA_KO, '괜찮아요', ''), 'ケンチャナヨ');
  assert.equal(hangulToKana('많이 주세요'), 'マニ チュセヨ');
  assert.equal(hangulToKana('싫어요'), 'シロヨ');
  assert.equal(hangulToKana('좋아요'), 'チョアヨ');
});

test('말해 볼 문장: 파싱·발음 붙이기·이력 정리', () => {
  assert.deepEqual(parseSay('본문.\n말해 볼 문장: すみません、お水ください (すみません おみず ください)'), { body: '본문.', sentence: 'すみません、お水ください', reading: 'すみません おみず ください' });
  assert.deepEqual(parseSay('본문\n言ってみる文：이거 주세요', false), { body: '본문', sentence: '이거 주세요', reading: '' });
  assert.equal(parseSay('괄호 (설명) 만 있는 본문'), null);
  assert.equal(sayWithPron('답.\n말해 볼 문장: すみません、お水ください (すみません おみず ください)', KO_JA), '답.\n말해 볼 문장: すみません、お水ください (스미마센 오미즈 쿠다사이)');
  assert.equal(sayWithPron('답.\n말해 볼 문장: お水ください (お水 ください)', KO_JA), '답.\n말해 볼 문장: お水ください', '읽기에 한자가 섞이면 발음 없이');
  assert.equal(sayWithPron('答え。\n말해 볼 문장: 이거 (하나) 주세요', JA_KO), '答え。\n말해 볼 문장: 이거 (하나) 주세요 (イゴ ハナ チュセヨ)');
  assert.equal(sayWithPron('答え。\n말해 볼 문장: 카드 돼요? (신용카드)', JA_KO), '答え。\n말해 볼 문장: 카드 돼요? (신용카드) (カドゥ テヨ? シニョンカドゥ)');
  assert.equal(sayWithPron('줄 없는 답', KO_JA), '줄 없는 답');
  assert.equal(stripSayPron('답.\n말해 볼 문장: すみません (스미마센)'), '답.\n말해 볼 문장: すみません');
});
