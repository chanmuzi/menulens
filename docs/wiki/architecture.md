# 구조와 파이프라인

> 2026-10-20 기준. 변경 시 이 페이지와 [[log/2026-10]] 를 같이 갱신한다.

## 흐름

1. **클라이언트** `src/lib/image.ts` — `<img>` 디코딩(EXIF 적용) → 긴 변 1280px JPEG(q0.85) → base64.
2. **`POST /api/analyze`** (`api/analyze.ts`, Node.js, 도쿄) — NDJSON 스트림으로 아래 이벤트를 순서대로 보낸다.
   - `ocr` — Upstage Document OCR(`model=ocr`) 결과: 단어 `{id,t,box}`(0~1000 정규화), `rotation`(90° 단위), `tilt`(도), `used`
   - `mode` — `ocr`(단어 ≥3) 또는 `image`(폴백: 이미지를 직접 보는 프롬프트), `chunks` 수
   - `item` — 1단계 LLM 항목이 완성될 때마다 `{key:"묶음:순번", item}`. 단어 60개 초과면 읽기 순서로 최대 4묶음을 **병렬** 호출(`api/_lib/chunk.ts`), 파싱은 서버(`api/_lib/itemStream.ts`)
   - `meta` — 모든 묶음 완료 후 `kind`(menu/sign/other)·`shop_name`·`notes`(비메뉴 문구)
   - `details` — 2단계 LLM: 10개씩 병렬로 `pron_ko/desc_ko/tags/photo_query`. Redis 캐시 적중분은 `cached:true` 로 먼저 온다
   - `done` / `error`
3. **클라이언트** `src/App.tsx` — 항목을 읽기 순서로 끼워 넣고(`insertItem`), `meta` 가 오면 결과 화면으로 전환(`detailing`), `details` 로 카드를 채운다. 완료 스캔은 localStorage 에 5건.

모델은 `api/_lib/prompt.ts` 의 `MODEL`(현재 `claude-sonnet-5-5`, Timely Router `/v1/messages`). 프롬프트 3종: `STAGE1_SYSTEM`(짧은 구조화), `STAGE2_SYSTEM`(설명), `IMAGE_SYSTEM`(폴백).

## 파일 지도

```
api/            Vercel Functions (Node.js, Web 표준 fetch 핸들러, ESM — 상대 import 에 .js 확장자 필수)
  analyze.ts    파이프라인 본체        auth.ts 초대 코드     rate.ts 환율     photo.ts Commons 사진(현재 미사용)
  _lib/         access(초대 코드) ocr chunk itemStream prompt kv(Redis) cache(설명 캐시) debugStore http
src/
  App.tsx       화면 상태 머신 gate → home → processing → result
  screens/      Gate Home Processing Result(Overlay / Cards / ItemSheet)
  components/   MenuPhoto(회전·기울기·확대·핀치 줌) PixelIcon Segmented ProgressBlocks ItemImage TopBar
  lib/          image api scan(정규화·unionBox·applyDetails) icons(키워드 우선) money storage photos savePhoto version
  styles/       global.css(토큰·픽셀 프레임·애니메이션) pixel-icons.css(생성: scripts/px_icons.py)
scripts/bench/  벤치·진단 스크립트        docs/wiki/   이 위키        vite-plugin-dev-api.ts  로컬에서 api/ 실행
```

## 검증

- `pnpm build` = tsc + vite. 로컬 `pnpm dev` 는 `.env` 를 읽어 `api/` 를 같은 프로세스에서 돌린다.
- 브라우저 흐름: 세션 scratchpad 에 `playwright-core` 를 설치하고 `chromium.launch({ channel: 'chrome' })` 으로 390×844 화면을 돌린다.
  표준 흐름 = 코드 입력 → 앨범 input 에 테스트 이미지 → 결과 화면(`button[aria-label="홈으로"]`) 대기 → 카드/오버레이 캡처.
  테스트 이미지는 `scripts/bench/make_menu_*.py` 로 생성(세로쓰기 短冊 8개, 기울어진 가로 14개).
- 프로덕션 스모크: `/api/auth`(틀린 코드 401), `/api/rate`, `/api/analyze` NDJSON 을 직접 호출.
- Safari 실기기 전용(공유 시트·핀치·카메라)은 재현 불가 → 사용자 확인 요청.
