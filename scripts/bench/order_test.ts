/**
 * 주문 문구 조립 검사(src/lib/orderText.ts). 한국어·일본어 원문의 틀, 「N인분」 계산, 괄호 보존, 원문과 앱 언어가 같을 때의 숨김을 고정한다.
 * 실행: node --experimental-strip-types --test scripts/bench/order_test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oneOrderText, orderText, spokenKo } from '../../src/lib/orderText.ts';
import { order as ko } from '../../src/i18n/ko/order.ts';
import { order as ja } from '../../src/i18n/ja/order.ts';
import type { MenuItem } from '../../src/types.ts';

const item = (name: string, tr: string, pron = ''): MenuItem => ({ id: 'a:1', name, tr, price: null, price_tax: null, pron, desc: '', tags: [], category: '식사', group: '', box: null, detailed: true } as unknown as MenuItem);
const KO_JA = { src: 'ko', dst: 'ja' } as const;
const JA_KO = { src: 'ja', dst: 'ko' } as const;

test('한국어 원문(일본어 앱): 틀·인분·괄호', () => {
  const lines = [
    { item: item('손칼국수', '手打ちカルグクス', 'ソンカルグクス'), qty: 1, lang: KO_JA },
    { item: item('삼겹살 (1인분 180g)', 'サムギョプサル', 'サムギョプサル'), qty: 2, lang: KO_JA },
    { item: item('부대찌개 (2인분)', 'プデチゲ', 'プデチゲ'), qty: 1, lang: KO_JA },
    { item: item('파전(대)', 'パジョン(大)', 'パジョン'), qty: 11, lang: KO_JA },
  ];
  const t = orderText(ja, lines, 'first', KO_JA);
  assert.equal(t.src, '저기요, 주문할게요.\n손칼국수 하나,\n삼겹살 2인분,\n부대찌개 2인분,\n파전(대) 11개.\n이상이요.');
  assert.equal(t.pron, 'チョギヨ, チュムンハルゲヨ.\nソンカルグクス ハナ,\nサムギョプサル 2インブン,\nプデッチゲ 2インブン,\nパジョン(テ) 11ケ.\nイサンイヨ.');
  assert.equal(t.tr, 'すみません、注文お願いします。\n手打ちカルグクス 1品、\nサムギョプサル 2品、\nプデチゲ 1品、\nパジョン(大) 11品。\n以上です。');
  assert.equal(orderText(ja, lines.slice(0, 2), 'plain', KO_JA).src, '손칼국수 하나,\n삼겹살 2인분\n주세요.');
  assert.equal(orderText(ja, lines.slice(0, 1), 'more', KO_JA).src, '저기요, 추가 주문할게요.\n손칼국수 하나.\n이상이요.');
  assert.equal(spokenKo('삼겹살 1인분'), '삼겹살');
  assert.equal(spokenKo('치킨(양념)반(후라이드)'), '치킨(양념)반(후라이드)');
  const one = oneOrderText(ja, lines[2]!.item, KO_JA);
  assert.deepEqual(one, { src: '부대찌개 2인분 주세요.', pron: 'プデッチゲ 2インブン チュセヨ.', tr: '「プデチゲを1つください」' });
});

test('일본어 원문(한국어 앱): 이전 문구 그대로', () => {
  const lines = [{ item: item('豚バラ串', '삼겹살 꼬치', '부타바라쿠시'), qty: 1, lang: JA_KO }, { item: item('唐揚げ', '가라아게', ''), qty: 2, lang: JA_KO }];
  const t = orderText(ko, lines, 'first', JA_KO);
  assert.equal(t.src, 'すみません、注文お願いします。\n豚バラ串 ひとつ、\n唐揚げ ふたつ。\n以上です。');
  assert.equal(t.pron, '스미마셍, 츄-몬 오네가이시마스.\n부타바라쿠시 히토츠,\n가라아게 후타츠.\n이죠-데스.');
  assert.equal(t.tr, '실례합니다, 주문할게요.\n삼겹살 꼬치 1개,\n가라아게 2개.\n이상입니다.');
  assert.equal(orderText(ko, lines, 'plain', JA_KO).src, '豚バラ串 ひとつ、\n唐揚げ ふたつ、\nお願いします。');
  assert.deepEqual(oneOrderText(ko, lines[0]!.item, JA_KO), { src: '豚バラ串を ひとつ ください。', pron: '부타바라쿠시오 히토츠 쿠다사이', tr: '「삼겹살 꼬치 하나 주세요」' });
});

test('원문과 앱 언어가 같으면 발음은 비운다', () => {
  const l = { item: item('김치찌개', '김치찌개', ''), qty: 1, lang: { src: 'ko', dst: 'ko' } as const };
  assert.equal(orderText(ko, [l], 'first', l.lang).pron, '');
  const j = { item: item('唐揚げ', '唐揚げ', ''), qty: 1, lang: { src: 'ja', dst: 'ja' } as const };
  assert.equal(orderText(ja, [j], 'first', j.lang).pron, '');
  assert.equal(oneOrderText(ja, j.item, j.lang).pron, '');
});
