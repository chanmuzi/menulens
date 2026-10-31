/**
 * 가나(히라가나·가타카나) → 한글 발음. 모델이 발음을 「짓지」 못하게, 모델은 읽기(가나)만 내고 한글은 여기서 규칙으로만 만든다.
 * 규칙(앱의 기존 표기와 맞춤): か행 → 카, た행 → 타, っ → 앞 글자 받침 ㅅ, ん → 앞 글자 받침 ㄴ, ー → 「-」.
 * 가나·ー·공백·중점 외의 글자(한자 등)가 섞이면 '' 를 돌려준다(화면은 발음을 비운다).
 */

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JONG_N = 4;   // ㄴ
const JONG_S = 19;  // ㅅ

type Syl = { readonly cho: number; readonly jung: number; jong: number };
type Piece = Syl | string;

const decompose = (ch: string): Syl => {
  const code = ch.charCodeAt(0) - 0xac00;
  return { cho: Math.floor(code / 588), jung: Math.floor((code % 588) / 28), jong: code % 28 };
};
const compose = (s: Syl): string => String.fromCharCode(0xac00 + (s.cho * 21 + s.jung) * 28 + s.jong);

/** 두 글자 조합(요음·외래어 표기)을 먼저, 그다음 한 글자 */
const TABLE: Readonly<Record<string, string>> = {
  きゃ: '캬', きゅ: '큐', きょ: '쿄', ぎゃ: '갸', ぎゅ: '규', ぎょ: '교',
  しゃ: '샤', しゅ: '슈', しょ: '쇼', じゃ: '자', じゅ: '주', じょ: '조',
  ちゃ: '챠', ちゅ: '츄', ちょ: '쵸', にゃ: '냐', にゅ: '뉴', にょ: '뇨',
  ひゃ: '햐', ひゅ: '휴', ひょ: '효', びゃ: '뱌', びゅ: '뷰', びょ: '뵤', ぴゃ: '퍄', ぴゅ: '퓨', ぴょ: '표',
  みゃ: '먀', みゅ: '뮤', みょ: '묘', りゃ: '랴', りゅ: '류', りょ: '료',
  てぃ: '티', でぃ: '디', とぅ: '투', どぅ: '두', ふぁ: '파', ふぃ: '피', ふぇ: '페', ふぉ: '포', ふゅ: '퓨',
  ゔぁ: '바', ゔぃ: '비', ゔぇ: '베', ゔぉ: '보', うぃ: '위', うぇ: '웨', うぉ: '워',
  ちぇ: '체', しぇ: '셰', じぇ: '제', つぁ: '차', つぇ: '체', つぉ: '초', でゅ: '듀',
  あ: '아', い: '이', う: '우', え: '에', お: '오',
  か: '카', き: '키', く: '쿠', け: '케', こ: '코', が: '가', ぎ: '기', ぐ: '구', げ: '게', ご: '고',
  さ: '사', し: '시', す: '스', せ: '세', そ: '소', ざ: '자', じ: '지', ず: '즈', ぜ: '제', ぞ: '조',
  た: '타', ち: '치', つ: '츠', て: '테', と: '토', だ: '다', ぢ: '지', づ: '즈', で: '데', ど: '도',
  な: '나', に: '니', ぬ: '누', ね: '네', の: '노',
  は: '하', ひ: '히', ふ: '후', へ: '헤', ほ: '호', ば: '바', び: '비', ぶ: '부', べ: '베', ぼ: '보', ぱ: '파', ぴ: '피', ぷ: '푸', ぺ: '페', ぽ: '포',
  ま: '마', み: '미', む: '무', め: '메', も: '모', や: '야', ゆ: '유', よ: '요',
  ら: '라', り: '리', る: '루', れ: '레', ろ: '로', わ: '와', ゐ: '이', ゑ: '에', を: '오', ゔ: '부',
  // 작은 글자가 홀로 오면 큰 글자처럼
  ぁ: '아', ぃ: '이', ぅ: '우', ぇ: '에', ぉ: '오', ゃ: '야', ゅ: '유', ょ: '요',
};

/** 가타카나 → 히라가나(ヴ 포함). 그 밖의 글자는 그대로 */
export const toHiragana = (text: string): string =>
  text.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60)).replace(/ヴ/g, 'ゔ');

/** 가나·ー·공백·중점·장음·촉음·발음으로만 된 글(읽기로 쓸 수 있는 글)인지 */
export const isKana = (text: string): boolean => /^[ぁ-ゖァ-ヺーゝゞ・\s]+$/.test(text) && text.trim().length > 0;

export const kanaToHangul = (input: string): string => {
  const text = toHiragana(input.normalize('NFKC'));
  if (!isKana(text)) return '';
  const pieces: Piece[] = [];
  /** 받침을 붙일 직전 음절. 장음 「-」 는 건너뛴다(チェーン → 첸-) */
  const last = (): Syl | null => { for (let k = pieces.length - 1; k >= 0; k--) { const p = pieces[k]; if (typeof p === 'object') return p; if (p !== '-') return null; } return null; };
  for (let i = 0; i < text.length; i++) {
    const two = text.slice(i, i + 2);
    if (two.length === 2 && TABLE[two]) { pieces.push(decompose(TABLE[two]!)); i++; continue; }
    const ch = text[i]!;
    if (ch === 'っ') { const l = last(); if (l && l.jong === 0) l.jong = JONG_S; continue; }
    if (ch === 'ん') {
      const l = last();
      if (l && l.jong === 0) l.jong = JONG_N;
      else pieces.push({ cho: CHO.indexOf('ㅇ'), jung: 18, jong: JONG_N }); // 홀로 선 ん → 「응」 대신 「은」
      continue;
    }
    if (ch === 'ー') { pieces.push('-'); continue; }
    if (ch === '・') { pieces.push(' '); continue; }
    if (/\s/.test(ch)) { pieces.push(' '); continue; }
    if (ch === 'ゝ' || ch === 'ゞ') continue;
    const one = TABLE[ch];
    if (!one) return '';
    pieces.push(decompose(one));
  }
  return pieces.map((p) => (typeof p === 'string' ? p : compose(p))).join('').replace(/\s+/g, ' ').trim();
};
