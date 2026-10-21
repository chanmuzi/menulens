# 구조와 파이프라인

> 2026-10-21 기준. 변경 시 이 페이지와 [[log/2026-10]] 를 같이 갱신한다.

## 흐름

1. **클라이언트** `src/lib/image.ts` — `<img>` 디코딩(EXIF 적용) → 긴 변 1280px JPEG(q0.85) → base64.
2. **`POST /api/analyze`** (`api/analyze.ts`, Node.js, 도쿄) — NDJSON 스트림으로 아래 이벤트를 순서대로 보낸다.
   - `ocr` — Upstage Document OCR(`model=ocr`) 결과: 단어 `{id,t,box}`(0~1000 정규화), `rotation`(90° 단위), `tilt`(도), `used`
   - `mode` — `ocr`(단어 ≥3) 또는 `image`(폴백: 이미지를 직접 보는 프롬프트), `chunks` 수
   - `kind` — 1단계 출력의 첫 키 `"kind"` 가 스트림에 보이는 즉시(항목보다 먼저, 한 번만). 처리 중 화면이 메뉴판/안내문에 맞는 문구로 바뀐다. 추가 호출 없음
   - `item` — 1단계 LLM 항목이 완성될 때마다 `{key:"묶음:순번", item}`. 단어 60개 초과면 읽기 순서로 최대 4묶음을 **병렬** 호출(`api/_lib/chunk.ts`), 파싱은 서버(`api/_lib/itemStream.ts`)
   - `meta` — 모든 묶음 완료 후 `kind`(menu/sign/other)·`shop_name`·`notes`(비메뉴 문구)
   - `details` — 2단계 LLM: 10개씩 병렬로 `pron_ko/desc_ko/tags/photo_query`. Redis 캐시 적중분은 `cached:true` 로 먼저 온다
   - `groups` — 메뉴판이고 항목 8개 이상일 때만, 2단계와 **병렬**로 한 번 더 LLM 호출(텍스트만, `GROUPS_SYSTEM`): 1단계가 항목마다 붙인 임시 `group` 을 메뉴판 전체 기준 4~8개 `{name, keys}` 로 합친다. 실패·소수 항목이면 안 보내고 클라이언트가 항목 group/category 로 묶는다(`src/lib/groups.ts`). 목록 표시 시간은 변하지 않고 정리는 목록 후 ≈2s
   - `done` / `error`
3. **클라이언트** `src/App.tsx` — 촬영·앨범 여러 장은 모음 화면(`ConfirmBatchScreen`, 더 찍기·순서)을 거친다. 촬영은 모음 화면에 있는 동안 첫 장을 미리 읽기 시작하고(`prewarm`), 「N장 분석하기」가 그 스캔을 이어받는다(`startScans` 가 batch 에 있는 스캔을 재사용, 빠진 것은 중단). 스캔마다 `AbortController` 를 따로 두어 결과 화면에서 사진을 더 붙여도(`addScans`) 나머지는 계속 돈다. 사진 묶음(`batch: Scan[]`, 한 장이면 하나)을 들고 `currentId` 의 스캔을 보여준다. 여러 장은 `runLimited`(`src/lib/batch.ts`, 동시 3)로 사진마다 `/api/analyze` 스트림을 따로 연다. `kind` 로 `scan.kind`·`kindKnown` 을 먼저 채우고, 항목을 읽기 순서로 끼워 넣고(`insertItem`), `meta` 가 오면 결과 화면으로 전환(`detailing`), `details` 로 카드를 채우고 `groups` 로 카드 묶음을 바꾼다. 완료 스캔은 IndexedDB(`src/lib/db.ts`, 목록 `scans` + 사진 `images` 두 저장소, 사진은 결과 화면을 열 때만 읽음)에 건수 제한 없이 저장하고, 홈에는 최근 5건·전체는 `HistoryScreen` 에서 본다. IndexedDB 를 못 쓰는 환경만 localStorage 5건 폴백.

4. **`POST /api/chat`** (`api/chat.ts`, `api/_lib/chatPrompt.ts`) — 결과 화면 챗. 입력은 항목·문구 축약 JSON(`src/lib/chat.ts` `chatContext`) + 맥락 항목 + 질문 + 최근 대화 6턴 + (필요 시) 사진. NDJSON `delta`/`done{refs,sawImage}`/`need_image`/`error`. 모델이 `[사진 필요]` 만 내면 서버가 `need_image` 로 끝내고 클라이언트(`ChatPopup`)가 사진을 붙여 다시 묻는다. 답 끝 「참조: k,k」 줄은 서버가 떼어 `done.text`·`refs` 로 보내고, 스트리밍 중에는 클라이언트 `stripRefs` 가 임시로 뗀다.

모델은 `api/_lib/prompt.ts` 의 `MODEL`(현재 `claude-sonnet-5-5`, Timely Router `/v1/messages`). 프롬프트 3종: `STAGE1_SYSTEM`(짧은 구조화), `STAGE2_SYSTEM`(설명), `IMAGE_SYSTEM`(폴백).

## 파일 지도

```
api/            Vercel Functions (Node.js, Web 표준 fetch 핸들러, ESM — 상대 import 에 .js 확장자 필수)
  analyze.ts    파이프라인 본체        auth.ts 초대 코드     rate.ts 환율     chat.ts 메뉴판 챗     photo.ts Commons 사진(현재 미사용)
  _lib/         access(초대 코드) ocr chunk itemStream prompt kv(Redis) cache(설명 캐시) debugStore http
src/
  App.tsx       화면 상태 머신 gate → home → processing → result
  screens/      Gate Home ConfirmBatch Processing Result(Overlay / Cards / ItemSheet / ChatPopup)
  components/   MenuPhoto(회전·기울기·확대·핀치 줌) PixelIcon Segmented ProgressBlocks ItemImage TopBar
  lib/          image api scan(정규화·unionBox·applyDetails) icons(키워드 우선) kind(종류별 문구) sample(덮개 색·배경 조각) money storage photos savePhoto version
  styles/       global.css(토큰·픽셀 프레임·애니메이션) pixel-icons.css(생성: scripts/px_icons.py)
scripts/bench/  벤치·진단 스크립트        docs/wiki/   이 위키        vite-plugin-dev-api.ts  로컬에서 api/ 실행
```

## 검증

- `pnpm build` = tsc + vite. 로컬 `pnpm dev` 는 `.env` 를 읽어 `api/` 를 같은 프로세스에서 돌린다.
- 브라우저 흐름: 세션 scratchpad 에 `playwright-core` 를 설치하고 `chromium.launch({ channel: 'chrome' })` 으로 390×844 화면을 돌린다.
  표준 흐름 = 코드 입력 → 앨범 input 에 테스트 이미지 → 결과 화면(`button[aria-label="홈으로"]`) 대기 → 카드/오버레이 캡처.
  테스트 이미지는 `scripts/bench/make_menu_*.py`(세로쓰기 短冊 8개, 기울어진 가로 14개)·`make_sign.py`(그라데이션 종이 위 안내 5줄) 로 생성.
- 프로덕션 스모크: `/api/auth`(틀린 코드 401), `/api/rate`, `/api/analyze` NDJSON 을 직접 호출.
- Safari 실기기 전용(공유 시트·핀치·카메라)은 재현 불가 → 사용자 확인 요청.

## 아이콘 생성 (2026-10-20)

- 매칭 순서와 보유 목록은 [[icons]]. 매칭 실패 항목은 `icon: 'camera'` 자리표시 → `ItemImage` 가 `src/lib/iconStore.ts` 로 300ms 묶음 요청 → `api/icon.ts` 가 Redis 캐시 확인 후 없는 것만 상위 모델로 생성(한 요청 12개·동시 4개) → 기기 localStorage 에 저장하고 즉시 교체.
- 비용: 메뉴명당 1회(Redis 1년 캐시). 실패한 이름은 세션 동안 재요청하지 않는다.

