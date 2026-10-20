# MenuLens — 에이전트 라우터

> **Version**: 1.0.0 · **Updated**: 2026-10-20
> **이 파일이 규약의 단일 진입점(SSoT)이다.** 아래 판정표로 작업 유형을 정하고 그 행의 경로만 로드한다.
> 전체 grep 은 라우팅으로 못 찾을 때의 최후 수단이다. 위키 루트는 `docs/wiki/index.md`.

일본 식당 메뉴판·안내문을 찍으면 한국어로 읽어주는 개인 모바일 웹 앱. Vite + React 프론트,
Vercel Node.js 함수 4개, Upstage OCR → Claude Sonnet(Timely Router) 2단 파이프라인.
배포 주소·초대 코드·키는 `.env`(미추적)와 Vercel 환경변수에만 있다.

## 절대 규칙 (위반 시 작업 중단)

1. **비밀은 저장소에 절대 넣지 않는다.** `.env`·`.env.local`·`.vercel/`은 gitignore 상태를 유지하고,
   `.env.example` 에는 가짜 예시만 쓴다. 초대 코드 실제 값(`ACCESS_CODES`)은 문서·커밋·PR 본문 어디에도 적지 않는다.
2. **`main` push = 프로덕션 배포.** Vercel Git 연동으로 main 에 푸시되면 즉시 배포된다.
   깨진 상태로 푸시하지 않는다: `pnpm build`(tsc 포함)가 통과하고, 가능하면 로컬 브라우저 흐름까지 확인한 뒤 푸시한다.
3. **비용이 드는 호출은 LLM 뿐이어야 한다.** 새 외부 서비스·유료 플랜·대시보드 설정 변경은 사용자 확인 후에만.
   무료 범위: Vercel Hobby, Redis Cloud Free(30MB), Upstage/Timely 는 호출당 과금.
4. **진단 저장(`DEBUG_STORE=1`)에는 사용자 사진이 남는다.** 분석이 끝나면 끄자고 제안한다. 내려받은 사진은 세션 scratchpad 밖에 두지 않는다.
5. **임시 파일·테스트 산출물은 저장소 트리에 두지 않는다.** 스크린샷·테스트 이미지·내려받은 스캔은 세션 scratchpad 에만.
   저장소에 남기는 것은 재현 스크립트(`scripts/bench/`)와 위키의 요약 숫자뿐이다.

## 작업유형 판정표 — 모든 작업의 첫 단계

| 유형 | 진입 경로 | 추가 로드 |
|---|---|---|
| 히스토리 파악 | `docs/wiki/log/index.md` → 최신 월 샤드 → `git log` | — |
| 구조·파이프라인 이해 | [[architecture]] | [[overlay-and-photo]] (화면 좌표·회전·라벨 규칙) |
| 속도·모델 변경 | [[benchmarks]] (측정 기록과 재현 방법) | `api/_lib/prompt.ts` · `api/analyze.ts` |
| 배포·환경변수·Redis | [[deploy-and-env]] | 절대 규칙 2·3 |
| 사용자 실기기 케이스 재현 | [[debug-store]] | 절대 규칙 4 |
| UI·문구·디자인 결정 | [[design-decisions]] (확정된 것 / 바꾸지 말 것) | [[backlog]] (사용자 결정 대기 항목) |
| 남은 과제 착수 | [[backlog]] | 해당 페이지 |
| 위키 쓰기 (신설·수정) | `docs/wiki/index.md` → 대상 페이지 | 신규 페이지는 인덱스에 등재 |

## 검증 절차 (코드 변경 공통)

1. `pnpm build` — tsc `--noEmit` 과 vite 빌드. 실패하면 푸시하지 않는다.
2. 로컬 서버 `pnpm dev` 는 `api/` 핸들러를 같은 프로세스에서 실행한다(Vercel CLI 불필요). `.env` 가 있어야 한다.
3. 브라우저 확인은 헤드리스 Chrome(playwright-core, 390×844)으로 흐름을 돌려 캡처를 보고 판단한다 — 절차는 [[architecture]] §검증.
   Safari 실기기 전용 동작(공유 시트, 핀치, 카메라)은 재현 불가 → 사용자 확인을 요청하고 그 사실을 보고에 적는다.
4. 배포 후에는 프로덕션 API 를 직접 호출해 스모크 확인한다(auth 401/200, rate, analyze 스트림).
5. 측정한 시간은 [[benchmarks]] 에 표로 남긴다. 체감 기준은 「목록 완성」 시점이다.

## 기록 의무 (모든 작업 공통)

1. 커밋 메시지는 `type(scope): 설명` 한국어, 본문은 왜·무엇 중심. 커밋 단위는 변경 의도별로 나눈다.
2. **작업 종료 시 결과 1엔트리** — `docs/wiki/log/YYYY-MM.md` **맨 위에**(newest-first) ≤3줄.
   커밋 해시·`[[페이지]]` 참조 포함, 상세 서술 금지. 착수·중간 진행은 쓰지 않는다.
3. 결정(채택·보류·폐기)이 바뀌면 [[design-decisions]] 또는 [[backlog]] 를 같은 PR 에서 갱신한다.

## Git 절차

1. 작업은 `main` 에서 분기한 브랜치(`feat/…`·`fix/…`·`docs/…`)에서 한다. 규약·문서 신설, 동작 변경이 큰 작업은 **PR 이 기본**이며 merge 는 사용자가 결정한다.
2. 작은 수정·핫픽스는 사용자가 "푸시해" 라고 했을 때만 main 직접 푸시. 그래도 검증 절차 1·4 는 생략하지 않는다.
3. squash merge 금지(히스토리 보존). rebase 로 최신화한다.
4. push 전 `git status --porcelain` 에 비밀 파일이 없는지 본다(절대 규칙 1).

## 정본 위치

- 규약: 이 파일. Claude Code 전용 델타는 `CLAUDE.md`(어댑터), 개인 설정은 `CLAUDE.local.md`(미추적).
- 위키 루트: `docs/wiki/index.md` · 로그: `docs/wiki/log/index.md`
- 측정 기록: `docs/wiki/benchmarks.md` · 재현 스크립트: `scripts/bench/`
- 환경변수 목록: `.env.example` · 배포 설정: `vercel.json`
