/**
 * 한글 → 가타카나 발음. 일본인 사용자가 한국어 메뉴 이름을 읽을 수 있게, 모델이 아니라 규칙으로만 만든다.
 * 소리 규칙은 단순화: 연음(받침 + ㅇ, ㅎ 받침은 탈락), 비음화(ㄱ·ㄷ·ㅂ 받침 + ㄴ·ㅁ), 유음화(ㄴ+ㄹ). 어두의 ㄱ·ㄷ·ㅂ·ㅈ은 청음, 어중은 탁음. ㅎ 격음화(축하 → 추카)는 아직 없다.
 * 된소리(ㄲ·ㄸ·ㅃ·ㅆ·ㅉ)는 어중에서 「ッ+청음」. 받침: ㄱ→ク(단 ㄱ·ㄷ·ㅂ·ㅈ 앞은 ッ), ㄴ·ㅇ→ン, ㄹ→ル, ㅁ→ム, ㅂ→プ, 그 밖(ㄷ·ㅅ·ㅈ·ㅊ·ㅌ·ㅎ)→ッ.
 * 장애음 받침(ㄱ·ㄷ·ㅂ 계열) 뒤의 ㄱ·ㄷ·ㅂ·ㅅ·ㅈ 은 된소리로 나므로 청음으로 적는다(떡볶이 → トッポッキ, 닭갈비 → タッカルビ).
 * 한글이 아닌 글자(숫자·영문·괄호·한자)는 그대로 둔다.
 * 서버(analyze)뿐 아니라 클라이언트(src/lib/orderText.ts)도 이 파일을 직접 import 한다 → node 전용 import(process, fs, ocr 등)를 넣지 말 것.
 */

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;
const JUNG = ['a', 'e', 'ya', 'ye', 'o', 'e', 'yo', 'ye', 'o', 'wa', 'we', 'we', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'u', 'ui', 'i'] as const; // ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const;

type Syl = { cho: string; jung: string; jong: string; plain?: boolean };
type Tok = Syl | string;

const isHangul = (ch: string): boolean => ch >= '가' && ch <= '힣';
const decompose = (ch: string): Syl => {
  const code = ch.charCodeAt(0) - 0xac00;
  return { cho: CHO[Math.floor(code / 588)]!, jung: JUNG[Math.floor((code % 588) / 28)]!, jong: JONG[code % 28]! };
};

/** 겹받침은 앞 자음이 남고 뒤 자음이 연음된다 */
const SPLIT_JONG: Readonly<Record<string, readonly [string, string]>> = { ㄳ: ['ㄱ', 'ㅅ'], ㄵ: ['ㄴ', 'ㅈ'], ㄶ: ['ㄴ', 'ㅎ'], ㄺ: ['ㄹ', 'ㄱ'], ㄻ: ['ㄹ', 'ㅁ'], ㄼ: ['ㄹ', 'ㅂ'], ㄽ: ['ㄹ', 'ㅅ'], ㄾ: ['ㄹ', 'ㅌ'], ㄿ: ['ㄹ', 'ㅍ'], ㅀ: ['ㄹ', 'ㅎ'], ㅄ: ['ㅂ', 'ㅅ'] };
/** 겹받침이 자음 앞에서 나는 대표음(닭→닥, 삶→삼, 값→갑) */
const REP_JONG: Readonly<Record<string, string>> = { ㄳ: 'ㄱ', ㄵ: 'ㄴ', ㄶ: 'ㄴ', ㄺ: 'ㄱ', ㄻ: 'ㅁ', ㄼ: 'ㄹ', ㄽ: 'ㄹ', ㄾ: 'ㄹ', ㄿ: 'ㅂ', ㅀ: 'ㄹ', ㅄ: 'ㅂ' };
const NASAL = new Set(['ㄴ', 'ㅁ']);
const OBSTRUENT_JONG = new Set(['ㄱ', 'ㄲ', 'ㅋ', 'ㄷ', 'ㅅ', 'ㅆ', 'ㅈ', 'ㅊ', 'ㅌ', 'ㅎ', 'ㅂ', 'ㅍ']);
const STOP_CHO = new Set(['ㄱ', 'ㄷ', 'ㅂ', 'ㅈ']);
const LENIS_CHO = new Set(['ㄱ', 'ㄷ', 'ㅂ', 'ㅅ', 'ㅈ']);
const toNasal = (jong: string): string => ('ㄱㄲㅋ'.includes(jong) ? 'ㅇ' : 'ㅂㅍ'.includes(jong) ? 'ㅁ' : 'ㄷㅅㅆㅈㅊㅌㅎ'.includes(jong) ? 'ㄴ' : jong);

/** 소리 규칙: 연음·비음화·유음화. 음절 배열을 새로 만들어 돌려준다 */
const applyRules = (syls: readonly Syl[]): Syl[] => {
  const out = syls.map((s) => ({ ...s }));
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i]!, b = out[i + 1]!;
    if (!a.jong) continue;
    if (b.cho === 'ㅇ') {
      // 연음: 받침이 다음 음절 초성으로. ㅇ 받침은 그대로, ㅎ 받침은 탈락
      const [stay, move] = SPLIT_JONG[a.jong] ?? ['', a.jong];
      if (move === 'ㅇ') continue;
      // ㅎ 탈락: 좋아요 → 조아요, 겹받침이면 남은 자음이 연음(많아요 → 마나요, 싫어요 → 시러요)
      if (move === 'ㅎ') { a.jong = ''; if (stay) b.cho = stay; continue; }
      a.jong = stay; b.cho = move === 'ㅅ' ? 'ㅅ' : move;
    } else if (NASAL.has(b.cho)) {
      a.jong = toNasal(REP_JONG[a.jong] ?? a.jong);
    } else if (a.jong === 'ㄴ' && b.cho === 'ㄹ') a.jong = 'ㄹ';
    else if (a.jong === 'ㄹ' && b.cho === 'ㄴ') b.cho = 'ㄹ';
    else {
      if (REP_JONG[a.jong]) a.jong = REP_JONG[a.jong]!;
      // 장애음 받침 뒤의 예사소리는 된소리로 난다 → 청음. ㄱ 받침은 ㄱ·ㄷ·ㅂ·ㅈ 앞에서 촉음(ッ)
      if (OBSTRUENT_JONG.has(a.jong) && LENIS_CHO.has(b.cho)) {
        b.plain = true;
        if ('ㄱㄲㅋ'.includes(a.jong) && STOP_CHO.has(b.cho)) a.jong = 'ッ';
      }
    }
  }
  return out;
};

/** 자음(로마자 키) + 모음 → 가타카나. 요음은 작은 글자로 */
const ROW: Readonly<Record<string, readonly [string, string, string, string, string]>> = {
  '': ['ア', 'イ', 'ウ', 'エ', 'オ'], k: ['カ', 'キ', 'ク', 'ケ', 'コ'], g: ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'], s: ['サ', 'シ', 'ス', 'セ', 'ソ'], j: ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ'],
  t: ['タ', 'ティ', 'トゥ', 'テ', 'ト'], d: ['ダ', 'ディ', 'ドゥ', 'デ', 'ド'], n: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'], h: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'], b: ['バ', 'ビ', 'ブ', 'ベ', 'ボ'], p: ['パ', 'ピ', 'プ', 'ペ', 'ポ'],
  m: ['マ', 'ミ', 'ム', 'メ', 'モ'], r: ['ラ', 'リ', 'ル', 'レ', 'ロ'], ch: ['チャ', 'チ', 'チュ', 'チェ', 'チョ'],
};
const Y_ROW: Readonly<Record<string, readonly [string, string, string]>> = {
  '': ['ヤ', 'ユ', 'ヨ'], k: ['キャ', 'キュ', 'キョ'], g: ['ギャ', 'ギュ', 'ギョ'], s: ['シャ', 'シュ', 'ショ'], j: ['ジャ', 'ジュ', 'ジョ'], t: ['チャ', 'チュ', 'チョ'], d: ['ジャ', 'ジュ', 'ジョ'],
  n: ['ニャ', 'ニュ', 'ニョ'], h: ['ヒャ', 'ヒュ', 'ヒョ'], b: ['ビャ', 'ビュ', 'ビョ'], p: ['ピャ', 'ピュ', 'ピョ'], m: ['ミャ', 'ミュ', 'ミョ'], r: ['リャ', 'リュ', 'リョ'], ch: ['チャ', 'チュ', 'チョ'],
};
const VOWEL_INDEX: Readonly<Record<string, number>> = { a: 0, i: 1, u: 2, e: 3, o: 4 };
const W_SMALL: Readonly<Record<string, string>> = { wa: 'ァ', wi: 'ィ', we: 'ェ', wo: 'ォ' };

/** 초성 → (청음, 탁음) 로마자 키. 된소리·거센소리는 청음 */
const CONS: Readonly<Record<string, readonly [string, string]>> = {
  ㄱ: ['k', 'g'], ㄲ: ['k', 'k'], ㄴ: ['n', 'n'], ㄷ: ['t', 'd'], ㄸ: ['t', 't'], ㄹ: ['r', 'r'], ㅁ: ['m', 'm'], ㅂ: ['p', 'b'], ㅃ: ['p', 'p'],
  ㅅ: ['s', 's'], ㅆ: ['s', 's'], ㅇ: ['', ''], ㅈ: ['ch', 'j'], ㅉ: ['ch', 'ch'], ㅊ: ['ch', 'ch'], ㅋ: ['k', 'k'], ㅌ: ['t', 't'], ㅍ: ['p', 'p'], ㅎ: ['h', 'h'],
};
const TENSE = new Set(['ㄲ', 'ㄸ', 'ㅃ', 'ㅆ', 'ㅉ']);
const JONG_KANA: Readonly<Record<string, string>> = { ㄱ: 'ク', ㄲ: 'ク', ㅋ: 'ク', ㄴ: 'ン', ㅇ: 'ン', ㄹ: 'ル', ㅁ: 'ム', ㅂ: 'プ', ㅍ: 'プ' };

const sylToKana = (s: Syl, initial: boolean, afterSokuon: boolean): string => {
  const [plain, voiced] = CONS[s.cho] ?? ['', ''];
  const c = initial || s.plain ? plain : voiced;
  const sokuon = !initial && !afterSokuon && TENSE.has(s.cho) ? 'ッ' : '';
  let body: string;
  const v = s.jung;
  if (v.length === 1) body = ROW[c]![VOWEL_INDEX[v]!]!;
  else if (v === 'ya' || v === 'yu' || v === 'yo') body = Y_ROW[c]![['ya', 'yu', 'yo'].indexOf(v)]!;
  else if (v === 'ye') body = c === '' ? 'イェ' : ROW[c]![3]!;
  else if (v === 'ui') body = c === '' ? 'ウィ' : ROW[c]![1]!;
  else body = c === '' ? `ウ${W_SMALL[v]!}` : v === 'we' && c !== '' ? ROW[c]![3]! : `${ROW[c]![2]!}${W_SMALL[v]!}`; // 과→クァ, 궈→クォ, 귀→クィ, 괴·궤→ケ
  const j = REP_JONG[s.jong] ?? s.jong; // 어말·공백 앞 겹받침도 대표음으로(찜닭 → チムダク)
  const jong = j ? (j === 'ッ' ? 'ッ' : JONG_KANA[j] ?? 'ッ') : '';
  return sokuon + body + jong;
};

export const hangulToKana = (input: string): string => {
  const text = input.normalize('NFC');
  const toks: Tok[] = [];
  let run: Syl[] = [];
  const flush = () => { if (run.length) { toks.push(...applyRules(run)); run = []; } };
  for (const ch of text) { if (isHangul(ch)) run.push(decompose(ch)); else { flush(); toks.push(ch); } }
  flush();
  let out = '';
  let initial = true;
  let prevSokuon = false;
  for (const t of toks) {
    if (typeof t === 'string') { out += t; initial = true; prevSokuon = false; continue; }
    const k = sylToKana(t, initial, prevSokuon);
    out += k;
    initial = false;
    prevSokuon = k.endsWith('ッ');
  }
  return out;
};
