# 구조와 파이프라인

> 2026-10-23 기준. 변경 시 이 페이지와 [[log/2026-10]] 를 같이 갱신한다.

## 흐름

1. **클라이언트** `src/lib/image.ts` — `<img>` 디코딩(EXIF 적용) → 긴 변 1280px JPEG(q0.85) → base64.
2. **`POST /api/analyze`** (`api/analyze.ts`, Node.js, 도쿄) — NDJSON 스트림으로 아래 이벤트를 순서대로 보낸다.
   - `ocr` — Upstage Document OCR(`model=ocr`) 결과: 단어 `{id,t,box}`(0~1000 정규화), `rotation`(90° 단위), `tilt`(도), `width`·`height`, `ms`, `used`(실패 시 `error`)
   - `lang` — 번역 방향 `{src, dst, currency}`. `dst` 는 클라이언트가 보낸 앱 언어(`lang` 본문 필드, 없으면 ko), `src` 는 OCR 단어의 문자 체계(한글 vs 가나·한자)로 판정(`api/_lib/direction.ts`), OCR 을 못 썼으면 앱 언어의 반대. 통화는 src 를 따른다(ko→KRW)
   - `mode` — `ocr`(단어 ≥3) 또는 `image`(폴백: 이미지를 직접 보는 프롬프트), `chunks` 수
   - `kind` — 1단계 출력의 첫 키 `"kind"` 가 스트림에 보이는 즉시(항목보다 먼저, 한 번만). 처리 중 화면이 메뉴판/안내문에 맞는 문구로 바뀐다. 추가 호출 없음
   - `item` — 1단계 LLM 항목이 완성될 때마다 `{key:"묶음:순번", item}`. 단어 60개 초과면 읽기 순서로 최대 4묶음을 **병렬** 호출(`api/_lib/chunk.ts`), 파싱은 서버(`api/_lib/itemStream.ts`)
   - `note` — 1단계 문구(안내문은 문단 `{role, lines, text, tr}`)가 완성될 때마다. 안내문은 첫 문단에서 결과 화면을 열어 덮개가 차례로 뜬다(최종본은 `meta.notes`)
   - `meta` — 모든 묶음 완료 후 `kind`(menu/sign/other)·`shop_name`·`title`(「이모지 제목」, 기록 목록용 자동 제목)·`notes`(비메뉴 문구)
   - `details` — 2단계 LLM: 10개씩 병렬로 `desc/tags/photo_query`(+ 일본어 원문이면 읽기 `kana`). **발음 `pron` 은 모델이 아니라 서버 규칙이 만든다**: 일→한은 `kana`(히라가나 읽기)를 `api/_lib/kanaToHangul.ts` 로 한글로 옮기고 가나가 아니면 비운다, 한→일은 이름 자체를 `api/_lib/hangulToKana.ts` 로 가타카나로 옮긴다(괄호 단위 제외). 규칙 검사는 `node --experimental-strip-types --test scripts/bench/rules_test.ts`. Redis 캐시 적중분은 `cached:true` 로 먼저 온다(캐시 키는 방향별, 일→한은 옛 키 그대로)
   - `summary` — 안내문·기타일 때 `meta` 뒤 한 번: 문단을 텍스트로 넘겨 `SUMMARY_SYSTEM` 으로 `{summary(사진에 적힌 것만), tips(일반 상식 0~2)}`. 실패하면 생략
   - `groups` — 메뉴판이고 항목 8개 이상일 때만, 2단계와 **병렬**로 한 번 더 LLM 호출(텍스트만, `GROUPS_SYSTEM`): 1단계가 항목마다 붙인 임시 `group` 을 메뉴판 전체 기준 4~8개 `{name, keys}` 로 합친다. 실패·소수 항목이면 안 보내고 클라이언트가 항목 group/category 로 묶는다(`src/lib/groups.ts`). 목록 표시 시간은 변하지 않고 정리는 목록 후 ≈2s
   - `done` / `error`
3. **클라이언트** `src/App.tsx` — 촬영·앨범 여러 장은 모음 화면(`ConfirmBatchScreen`, 더 찍기·순서)을 거친다. 촬영은 모음 화면에 있는 동안 첫 장을 미리 읽기 시작하고(`prewarm`), 「N장 분석하기」가 그 스캔을 이어받는다(`startScans` 가 batch 에 있는 스캔을 재사용, 빠진 것은 중단). 스캔마다 `AbortController` 를 따로 두어 결과 화면에서 사진을 더 붙여도(`addScans`) 나머지는 계속 돈다. 사진 묶음(`batch: Scan[]`, 한 장이면 하나)을 들고 `currentId` 의 스캔을 보여준다. 여러 장은 `runLimited`(`src/lib/batch.ts`, 동시 3)로 사진마다 `/api/analyze` 스트림을 따로 연다. `kind` 로 `scan.kind`·`kindKnown` 을 먼저 채우고, 항목을 읽기 순서로 끼워 넣고(`insertItem`), `meta` 가 오면 결과 화면으로 전환(`detailing`), `details` 로 카드를 채우고 `groups` 로 카드 묶음을 바꾼다. 완료 스캔은 IndexedDB(`src/lib/db.ts`, 목록 `scans` + 사진 `images` 두 저장소, 사진은 결과 화면을 열 때만 읽음)에 건수 제한 없이 저장하고(목록 레코드에는 168px 썸네일 `thumb`·자동 제목 `autoTitle`·고친 이름 `userTitle` 이 함께 들고, 옛 기록 썸네일은 앱을 열 때 `backfillThumbs` 가 채운다. 제목 규칙은 `src/lib/history.ts`), 홈에는 최근 5건·전체는 `HistoryScreen` 에서 본다. IndexedDB 를 못 쓰는 환경만 localStorage 5건 폴백.

4. **`POST /api/chat`** (`api/chat.ts`, `api/_lib/chatPrompt.ts` 의 종류·방향별 `chatSystem(kind, photos, lang)`) — 결과 화면 챗. 답은 사진의 번역 언어(`lang.dst`, 클라이언트가 지금 보는 사진의 `Scan.lang` 을 보냄, 없으면 일→한)로 쓰고 프로토콜 표시(`[사진 필요]`·`참조:`)는 답 언어와 상관없이 한국어. 입력은 묶음 사진 전부의 항목·문구 축약 JSON(`src/lib/chat.ts` `chatContext`, 묶음이면 항목 키 「사진번호-묶음:순번」과 `p`, `photos`, `lang`) + 맥락 항목 + 질문 + 최근 대화 6턴 + (필요 시) 사진 한 장과 그 번호 `imagePhoto`. NDJSON `delta`/`done{refs,sawImage}`/`need_image{photo}`/`error`. 모델이 `[사진 필요]`(묶음이면 `[사진 필요: n]`) 만 내면 서버가 `need_image` 로 끝내고 클라이언트(`ChatPopup`)가 그 사진을 붙여 다시 묻는다(질문당 최대 2장). 사진을 붙였는데 같은 장을 또 달라고 하면 「찾지 못했어요」로 끝낸다. 답 끝 「참조: k,k」 줄은 서버가 떼어 `done.text`·`refs` 로 보내고, 스트리밍 중에는 클라이언트 `stripRefs` 가 임시로 뗀다.

5. **`POST /api/stt`** (`api/stt.ts`, `api/_lib/stt.ts`) — 대화 통역 음성 인식. 본문은 녹음 파일 그대로(`content-type: audio/*`, 3MB 상한), 헤더 `x-lang: ko|ja`. Groq `whisper-large-v3-turbo` → 한도(429)·5xx·키 오류면 Gemini `gemini-3.5-transcribe`(Interactions API) → 둘 다 실패면 503 `{error:'stt_unavailable', retryAfter}`. Whisper 는 무음에도 「감사합니다」를 지어내므로 소리가 작거나 짧은 녹음은 클라이언트가 보내지 않는다.
5-1. **클라이언트 대화 통역** (`src/screens/TalkScreen.tsx`) — 말하기는 `recorder.ts`(MediaRecorder: iPhone audio/mp4, Chrome audio/webm, AnalyserNode 로 소리 크기를 재 말이 끝나고 1.3s 조용하면 끝, 말소리 0.3s 미만이면 보내지 않음) → `/api/stt` → 마디 추가 → `/api/talk` translate 의 `field` 를 받는 대로 `applyFields`(lang 이 ja 면 상대 말로). 마디가 끝날 때마다 `talkStore`(IndexedDB `menulens-talk`, 스캔 DB 와 별개, 실패 시 localStorage 20건)에 저장. 결정은 [[decisions-talk]].
6. **`POST /api/talk`** (`api/talk.ts`, 프롬프트 `api/_lib/talkPrompt.ts`, 호출 `api/_lib/claude.ts`) — 대화 통역의 글자 쪽. `mode:'translate'` 는 NDJSON `field{k,v}`(값이 닫힌 문자열 필드부터: `lang` → 번역문 `ja`/`ko` → `fixed`(오인식 고친 원문) → `pron`·`kana`·`en`) 뒤 `done{result,via}`, `mode:'ask'`(도우미)는 `delta`/`done`, `mode:'title'` 은 `{title}`. Claude 는 Timely 가 기본이고 402·429·한도 문구면 같은 요청을 Anthropic 직접 키로 한 번 더(`via` 로 구분).

모델은 `api/_lib/prompt.ts` 의 `MODEL`(현재 `claude-sonnet-5-5`, Timely Router `/v1/messages`). 프롬프트 5종은 방향 `{src, dst}` 를 받는 함수(`api/_lib/prompt.ts`): `stage1System`(짧은 구조화, 끝에 기록용 `emoji`·`title`), `stage2System`(설명·읽기), `groupsSystem`(카드 묶음 정리), `summarySystem`(안내문 요약), `imageSystem`(폴백). 본문은 한국어로 쓰고 원문·대상 언어, 나라, 가격 규칙(엔: 세전/세후, 원: 「9.0」= 9,000원·세금 포함)만 바꾼다. 분류·태그는 앱 내부 코드라 어느 방향이든 한국어 값. 챗은 `api/_lib/chatPrompt.ts` 의 `chatSystem(kind, photos, lang)`(답 언어는 `lang.dst`), 아이콘 생성은 `api/icon.ts`.

## 파일 지도

```
api/            Vercel Functions (Node.js, Web 표준 fetch 핸들러, ESM — 상대 import 에 .js 확장자 필수)
  analyze.ts 파이프라인 본체   chat.ts 결과 화면 챗   icon.ts 도트 아이콘 격자 생성(상위 모델 → 폴백)   auth.ts 초대 코드   rate.ts 환율
  photo.ts Commons 사진(사진 토글이 비활성이라 호출되지 않음, 경로는 살아 있음)   stt.ts 대화 음성 인식   talk.ts 대화 번역·도우미·제목
  _lib/  access(초대 코드) ocr chunk itemStream prompt(방향별 함수) direction(원문 언어 판정·통화) kanaToHangul·hangulToKana(발음 규칙) chatPrompt kv(Redis) cache(설명 캐시 180일, 방향별 키) iconCache(아이콘 365일) debugStore(진단 20건·7일) pixel(서버 팔레트) http
         stt(Groq → Gemini) claude(Timely → 한도 시 Anthropic 직접, SSE 읽기) talkPrompt(번역·제목·도우미)
src/
  App.tsx       화면 상태 머신 gate → home ⇄ history → confirm(모음·자르기) → processing → result, home ⇄ talk(대화 통역), 스캔 오케스트레이션(runScan·startScans·addScans), 대화 목록·이름 고치기·지우기
  screens/      Gate Home(사진·대화 탭) History(사진·대화 탭) ConfirmBatch Crop Processing Result(OverlayView·CardsView·NoticePanel·ItemSheet·OrderSheet·ChatPopup) LeaveDialog(중단 확인)
                Talk(대화 통역: 말풍선·말하기·글로 쓰기·표시 언어) TalkHelper(도우미 시트)
  components/   NoticeCovers(안내문 문단 덮개·번호) MenuPhoto(회전·기울기·확대·핀치 줌) BatchStrip(사진 띠·더 찍기) ScanRow(기록 줄) DotGlyph(연필·휴지통·카메라·말풍선 등 10×10, Segmented 의 icon)
                TalkBubble(말풍선 세 줄) ShowBig(크게 보여주기) TalkRow(대화 기록 줄)
                ConfirmDialog(지우기 확인) RenameDialog(이름 고치기) ChatFab OrderBar QtyStepper CropBox InstallHint PixelIcon Segmented ProgressBlocks ItemImage TopBar
  lib/          image api scan(정규화·unionBox·applyDetails) coverLayout(덮개/번호 판정·글자 맞춤) sample(덮개 배경·글자색) icons(키워드 우선) iconStore pixel kind(종류별 문구)
                order(주문 수량·묶음 줄·주문 언어 기준) orderText(주문 문구 조립, 순수 함수: 원문 언어별 틀, 발음은 `api/_lib/hangulToKana.ts` 를 클라이언트가 직접 import — 의존성 없는 순수 함수라 양쪽에서 쓴다, node 전용 모듈을 넣지 말 것. 검사 `node --experimental-strip-types --test scripts/bench/order_test.ts`) money(통화·환산)
                upgrade(빈 스캔 기본값·옛 기록 변환: 2026-10-31 필드 중립화 이전 키 name_ja 등을 name/tr 로) history(기록 묶음·제목 규칙) when(날짜·요일·12시간제) storage(저장 큐·이름 고치기·썸네일 채우기·홈 탭·대화 화면 설정) db(IndexedDB) thumb(168px 썸네일) batch(runLimited)
                groups chat order(묶음 전체 수량 BatchOrder·주문 문구) money(통화별 표기·양방향 환산 formatMoney/formatConverted/splitMoney) crop clipboard drop platform photos savePhoto(묶음 전부 공유) version
                talk(마디·말풍선 언어·제목·「말해 볼 문장」) talkApi(/api/stt·/api/talk) talkStore(IndexedDB menulens-talk) ndjson(스트림 줄 읽기: chat·talkApi 공용) recorder(녹음·소리 크기·무음 거르기)
  styles/       global.css(토큰·픽셀 프레임·애니메이션) pixel-icons.css(생성: scripts/px_icons.py)
  i18n/         lang(앱 언어 ko|ja: 기기 언어 기본, localStorage menulens.lang, useLang) index(useT·dict) ko/·ja/ 네임스페이스 사전(common data home history confirm processing result order chat talk lib tips app). 화면은 useT(), lib 은 호출 시점 dict()
scripts/bench/  벤치·진단 스크립트        docs/wiki/   이 위키        vite-plugin-dev-api.ts  로컬에서 api/ 실행
```

## 검증

- `pnpm build` = tsc + vite. 로컬 `pnpm dev` 는 `.env` 를 읽어 `api/` 를 같은 프로세스에서 돌린다.
- 브라우저 흐름: 세션 scratchpad 에 `playwright-core` 를 설치하고 `chromium.launch({ channel: 'chrome' })` 으로 390×844 화면을 돌린다.
  표준 흐름 = 코드 입력 → 앨범 input 에 테스트 이미지 → 결과 화면(`button[aria-label="홈으로"]`) 대기 → 카드/오버레이 캡처.
  테스트 이미지는 `scripts/bench/make_menu_*.py`(세로쓰기 短冊 8개, 기울어진 가로 14개)·`make_sign.py`(그라데이션 종이 위 안내 5줄) 로 생성.
- 프로덕션 스모크: `/api/auth`(틀린 코드 401), `/api/rate`, `/api/analyze` NDJSON 을 직접 호출. 대화 통역은 `/api/stt`(합성 음성 m4a, `scripts/bench/talk_stt.mjs` 가 만드는 것과 같은 방식)·`/api/talk` translate.
- Safari 실기기 전용(공유 시트·핀치·카메라)은 재현 불가 → 사용자 확인 요청.

## 아이콘 생성 (2026-10-20)

- 매칭 순서와 보유 목록은 [[icons]]. 매칭 실패 항목은 `icon: 'camera'` 자리표시 → `ItemImage` 가 `src/lib/iconStore.ts` 로 300ms 묶음 요청 → `api/icon.ts` 가 Redis 캐시 확인 후 없는 것만 상위 모델로 생성(한 요청 12개·동시 4개) → 기기 localStorage 에 저장하고 즉시 교체.
- 비용: 메뉴명당 1회(Redis 1년 캐시). 실패한 이름은 세션 동안 재요청하지 않는다.

