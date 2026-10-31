/**
 * 서버 규칙 검사: 발음 변환(가나→한글, 한글→가타카나)과 원문 언어 판정. 모델이 발음을 짓지 않고 규칙으로만 만드는 경로를 고정한다.
 * 실행: node --experimental-strip-types --test scripts/bench/rules_test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kanaToHangul, isKana, toHiragana } from '../../api/_lib/kanaToHangul.ts';
import { hangulToKana } from '../../api/_lib/hangulToKana.ts';
import { detectSrc } from '../../api/_lib/direction.ts';

test('가나 → 한글: 앱의 기존 표기와 같다', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['からあげ', '카라아게'], ['ひとつ', '히토츠'], ['ふたつ', '후타츠'], ['みっつ', '밋츠'], ['よっつ', '욧츠'], ['ここのつ', '코코노츠'],
    ['おねがいします', '오네가이시마스'], ['すみません', '스미마센'], ['ちゅうもん', '츄우몬'], ['らーめん', '라-멘'], ['ぎゅうどん', '규우돈'],
    ['なまびーる', '나마비-루'], ['えだまめ', '에다마메'], ['とんこつ', '톤코츠'], ['かんぱい', '칸파이'], ['りんご', '린고'], ['さんま', '산마'],
    ['ハイボール', '하이보-루'], ['ティラミス', '티라미스'], ['カフェラテ', '카페라테'], ['ヴァニラ', '바니라'], ['チェーン', '첸-'],
  ];
  for (const [kana, want] of cases) assert.equal(kanaToHangul(kana), want, kana);
});

test('가나 → 한글: 가나가 아닌 글자가 섞이면 비운다(모델이 한자·로마자로 얼버무린 읽기는 쓰지 않는다)', () => {
  assert.equal(kanaToHangul('唐揚げ'), '');
  assert.equal(kanaToHangul('karaage'), '');
  assert.equal(kanaToHangul(''), '');
  assert.equal(isKana('からあげ'), true);
  assert.equal(isKana('から揚げ'), false);
  assert.equal(toHiragana('ラーメン'), 'らーめん');
});

test('한글 → 가타카나: 대표 메뉴', () => {
  const cases: ReadonlyArray<readonly [string, string]> = [
    ['삼겹살', 'サムギョプサル'], ['불고기', 'プルゴギ'], ['김치', 'キムチ'], ['떡볶이', 'トッポッキ'], ['막걸리', 'マッコルリ'], ['국밥', 'クッパプ'],
    ['냉면', 'ネンミョン'], ['된장찌개', 'テンジャンッチゲ'], ['순두부', 'スンドゥブ'], ['잡채', 'チャプチェ'], ['칼국수', 'カルグクス'],
    ['소주', 'ソジュ'], ['한우 등심', 'ハヌ トゥンシム'], ['김밥', 'キムバプ'], ['해물파전', 'ヘムルパジョン'], ['닭갈비', 'タッカルビ'], ['비빔밥', 'ピビムバプ'], ['찜닭', 'チムダク'], ['통닭', 'トンダク'], ['값', 'カプ'], ['닭 한마리', 'タク ハンマリ'],
  ];
  for (const [ko, want] of cases) assert.equal(hangulToKana(ko), want, ko);
});

test('원문 언어 판정: 앱 언어가 기대하는 외국어 글자가 있으면 그쪽', () => {
  const w = (...t: string[]) => t.map((x, id) => ({ id, t: x, box: [0, 0, 1, 1] as const }));
  assert.equal(detectSrc(w('唐揚げ定食', '980円', '닭튀김', '정식', '(닭고기', '튀김과', '밥)'), 'ko'), 'ja', '한국어 병기 일본 메뉴판, 한국어 UI');
  assert.equal(detectSrc(w('김치찌개', '9,000', 'キムチチゲ'), 'ja'), 'ko', '일본어 병기 한국 메뉴판, 일본어 UI');
  assert.equal(detectSrc(w('손칼국수', '9,000', '삼겹살'), 'ko'), 'ko', '한국어 UI 로 한국 사진(가나 없음 → 다수결)');
  assert.equal(detectSrc(w('豚バラ串', '170円'), 'ja'), 'ja', '일본어 UI 로 일본 사진');
  assert.equal(detectSrc(w('OPEN', '24'), 'ko'), 'ja', '영문·숫자뿐이면 기대하는 외국어');
  assert.equal(detectSrc([], 'ja'), 'ko');
});

test('한글 → 가타카나: 한글이 아닌 글자는 그대로', () => {
  assert.equal(hangulToKana('삼겹살 (1인분 180g)'), 'サムギョプサル (1インブン 180g)');
  assert.equal(hangulToKana('ABC'), 'ABC');
});
