# MenuLens — 에이전트 라우터

> **Version**: 1.6.2 · **Updated**: 2026-11-01
> **이 파일이 규약의 단일 진입점(SSoT)이다.** 아래 판정표로 작업 유형을 정하고 그 행의 경로만 로드한다.
> 전체 grep 은 라우팅으로 못 찾을 때의 최후 수단이다. 위키 루트는 `docs/wiki/index.md`.

식당 메뉴판·안내문을 찍으면 읽어주는 개인 모바일 웹 앱: 한국인은 일본어 사진을 한국어로, 일본인은 한국어 사진을 일본어로(앱 언어 설정, 원문 언어 자동 판정, 발음은 규칙). Vite + React 프론트,
Vercel Node.js 함수 8개, Upstage OCR → LLM 2단 파이프라인. LLM 은 `api/_lib/llm.ts` 의 제공자 스위치(`LLM_PROVIDER`: Timely Router·Anthropic·OpenAI·Upstage Solar, 프로덕션은 Timely 의 Claude Sonnet).
대화 통역은 Groq Whisper(예비 Gemini) 음성 인식 → 같은 LLM 번역(Timely 일 때 한도 시 Anthropic 직접 키).
배포 주소·초대 코드·키는 `.env`(미추적)와 Vercel 환경변수에만 있다.

## 절대 규칙 (위반 시 작업 중단)

1. **비밀은 저장소에 절대 넣지 않는다.** `.env`·`.env.local`·`.vercel/`은 gitignore 상태를 유지하고,
   `.env.example` 에는 가짜 예시만 쓴다. 초대 코드 실제 값(`ACCESS_CODES`)은 문서·커밋·PR 본문 어디에도 적지 않는다.
   **저장소는 공개(public)다.** 개인 정보(이메일·실명·연락처), 사용자 사진·진단 데이터 원문, 사진 속 사적인 글(메시지 등)은 커밋·PR·위키에 넣지 않는다(위키에는 요약 숫자와 일반화한 서술만).
   초대 코드는 저장소에서 보이는 문자열(GitHub 계정명·프로젝트명·예시 값)과 같으면 안 된다. 커밋 전 의심되면 `.env` 값으로 추적 파일을 grep 해 확인한다(값은 출력하지 않는다).
2. **`main` push = 프로덕션 배포.** Vercel Git 연동으로 main 에 푸시되면 즉시 배포된다.
   **2026-11-01 부터 자동 배포를 꺼 두었다**(`vercel.json` `git.deploymentEnabled: false`, 배포본도 내림. 사용자 결정, [[deploy-and-env]] §배포 중단). 되살리기 전까지 「Vercel READY 확인·프로덕션 스모크」 단계는 건너뛰고 보고에 「배포 중단 중」이라고 적는다. 되살리려면 그 설정을 지우는 PR 뒤 Vercel 대시보드에서 Redeploy.
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
| 속도·모델 변경 | [[benchmarks]] (측정 기록과 재현 방법) | `api/_lib/prompt.ts` · `api/analyze.ts` · 제공자·모델 스위치는 `api/_lib/llm.ts` · [[deploy-and-env]] §LLM 제공자 |
| 배포·환경변수·Redis(키·용량) | [[deploy-and-env]] | 절대 규칙 2·3 · 진단 키는 [[debug-store]] |
| 사용자 실기기 케이스 재현 | [[debug-store]] | 절대 규칙 4 |
| UI·문구·디자인 결정 | [[design-decisions]] (작업 원칙·공통·폐기, 하위 페이지 안내) | 결과 화면이면 [[decisions-result]], 입력·처리·기록이면 [[decisions-input]] · [[backlog]] |
| 결과 화면(오버레이·카드·주문서·챗·사진 저장) | [[decisions-result]] | [[architecture]] 파일 지도 |
| 안내문 덮개·정리 영역(요약·번역문·원문) | [[overlay-and-photo]] §안내문 덮개 | `src/lib/coverLayout.ts` · [[decisions-result]] |
| 입력·여러 장·처리 중·기록 목록·이름 고치기 | [[decisions-input]] | [[architecture]] 파일 지도 |
| 대화 통역(말하기·번역·도우미·대화 기록) | [[decisions-talk]] | [[architecture]] §stt·talk · [[deploy-and-env]] 키·무료 한도 |
| 아이콘 추가·매칭 수정 | [[icons]] | `.claude/skills/pixel-icon` |
| 앱 언어·번역 방향·발음 규칙 | [[design-decisions]] §앱 언어·역방향 분석 | `api/_lib/direction.ts` · `prompt.ts`(방향 함수) · 발음 규칙 `kanaToHangul.ts`·`hangulToKana.ts`·`talkPron.ts` · 검사 `scripts/bench/*_test.ts` · 문구는 `src/i18n` |
| 남은 과제 착수 | [[backlog]] | 해당 페이지 |
| 위키 쓰기 (신설·수정) | `docs/wiki/index.md` → 대상 페이지 | 신규 페이지는 인덱스에 등재 |

## 검증 절차 (코드 변경 공통)

1. `pnpm build` — tsc `--noEmit` 과 vite 빌드. 실패하면 푸시하지 않는다. 발음·언어 판정·주문 문구 규칙을 건드렸으면 `node --experimental-strip-types --import ./scripts/bench/register-ts.mjs --test scripts/bench/rules_test.ts scripts/bench/talk_test.ts scripts/bench/order_test.ts` 도 통과해야 한다.
2. 로컬 서버 `pnpm dev` 는 `api/` 핸들러를 같은 프로세스에서 실행한다(Vercel CLI 불필요). `.env` 가 있어야 한다.
3. 브라우저 확인은 헤드리스 Chrome(playwright-core, 390×844)으로 흐름을 돌려 캡처를 보고 판단한다 — 절차는 [[architecture]] §검증.
   Safari 실기기 전용 동작(공유 시트, 핀치, 카메라)은 재현 불가 → 사용자 확인을 요청하고 그 사실을 보고에 적는다.
4. 배포 후에는 프로덕션 API 를 직접 호출해 스모크 확인한다(auth 401/200, rate, analyze 스트림).
5. 측정한 시간은 [[benchmarks]] 에 표로 남긴다. 체감 기준은 「목록 완성」 시점이다.

## 기록 의무 (모든 작업 공통)

1. 커밋 메시지는 `type(scope): 설명` 한국어, 본문은 왜·무엇 중심. 커밋 단위는 변경 의도별로 나눈다.
2. **작업 종료 시 결과 1엔트리** — `docs/wiki/log/YYYY-MM.md` **맨 위에**(newest-first) ≤3줄.
   **PR 번호**(엔트리는 PR 생성 전에 쓰므로 `gh pr list --state all --limit 1` 의 다음 번호) 또는 직접 푸시면 커밋 해시, 그리고 `[[페이지]]` 참조 포함. 상세 서술 금지. 착수·중간 진행은 쓰지 않는다.
3. 결정(채택·보류·폐기)이 바뀌면 같은 PR 에서 해당 결정 페이지를 갱신한다: 공통·원칙·폐기는 [[design-decisions]], 결과 화면은 [[decisions-result]], 입력·처리·기록은 [[decisions-input]], 대화 통역은 [[decisions-talk]], 미결은 [[backlog]].
4. 측정한 시간은 [[benchmarks]] 에 날짜·환경·사진과 함께 표로(로그에만 남기지 않는다). 재현 스크립트는 `scripts/bench/`.
5. 새 파일·모듈·API 이벤트·환경변수·Redis 키가 생기면 같은 PR 에서 [[architecture]] 파일 지도 / [[deploy-and-env]] 를 갱신한다. 새 위키 페이지는 `docs/wiki/index.md` 와 위 판정표에 등재.

## Git 절차

1. **쓰기 작업은 브랜치에서** — `main` 에서 분기한 `docs/…`·`feat/…`·`fix/…`. 브랜치명은 생성 시점부터 관례대로 짓는다(rename 단계 없음).
   병렬 세션이 있을 수 있으면 워크트리를 쓴다: `git worktree add -b <타입>/<슬러그> ../menulens-<슬러그> origin/main`
   (형제 경로 고정, 레포 안 `.claude/worktrees/` 금지, EnterWorktree 도구 사용 금지). 작업 중 fetch·pull 금지 — 분기 시점 스냅샷을 유지한다(push 시점의 rebase 는 4항의 예외).
2. **반영 경로는 PR 이 기본** — 규약·문서 신설, 동작 변경, 설정 변경 전부. 사용자가 "푸시해" 라고 명시한 작은 수정만 main 직접 푸시(검증 절차는 그대로).
3. **merge 는 에이전트가 직접** `gh pr merge --merge --delete-branch` 로 한다 (merge commit, **squash 금지**).
   검증 절차와 로컬 리뷰를 통과한 PR 은 승인을 기다리지 않고 merge 해 프로덕션에 올린 뒤 보고한다 — 사용자는 코드가 아니라 **프로덕션 실기기 동작**으로 확인한다.
   예외(merge 전에 묻는다): 저장 데이터 형식·환경변수·외부 서비스·비용에 영향이 있는 변경, 되돌리기 어려운 변경, 사용자가 "merge 전에 보자" 고 한 작업.
4. push 거부·main 선행 시 `git fetch` → `git rebase origin/main` → 재시도. PR 브랜치는 `--force-with-lease`. rebase 외 히스토리 재작성은 사용자 확인.
5. push 전 `git status --porcelain` 에 비밀 파일이 없는지 본다(절대 규칙 1).

## 작업 완료 프로토콜 (PR 대상 작업)

1. **구현** — 외부 provider 호출·환경변수·배포 설정·저장 데이터(localStorage·Redis)를 바꾸면 비용·보안·호환(이전 저장 데이터) 영향을 계획 단계에서 적고, 결정이 필요하면 PR 전에 묻는다.
2. **검증** — `pnpm build` 통과 + 실측(브라우저 흐름·프로덕션 스모크). 정적 확인만으로 "완료" 보고 금지.
3. **로컬 리뷰** — 커밋 전 `git-claw:code-review --wd` 로 작업 디렉터리 diff 를 리뷰한다. 결과는 로컬에만 둔다(PR 에 게시하지 않는다).
   문서·규약만 바꾸는 변경은 에이전트를 띄우지 않는 단일 패스 리뷰(`-q` 또는 직접 검토)로 갈음할 수 있으며, 그 사실을 보고에 적는다.
4. **리뷰 반영** — 지적을 고치고 2 를 다시 통과. 받아들이지 않은 지적은 이유와 함께 보고에 적는다.
5. **커밋·PR** — `git-claw:commit` / `git-claw:pr`. PR 본문에 "로컬 리뷰 N건 반영(미반영 M건: 사유)" 한 줄.
6. **merge → 프로덕션 배포** — 보고 전에 PR 을 merge 한다(Git 절차 3, 예외도 거기). main 푸시로 Vercel 이 자동 배포하므로 `npx vercel` 로 직접 배포하지 않는다.
   Vercel 프로덕션 Ready 는 **merge 커밋 기준**으로 확인한다(`npx vercel api "/v6/deployments?projectId=menulens&target=production&limit=1"` 의 커밋 해시·state, [[deploy-and-env]]). `vercel ls` 표 출력은 깨져 읽히지 않을 수 있어 근거로 쓰지 않는다. 그다음 프로덕션 API 스모크(auth 401/200, rate)를 돌리고 마무리 세트까지 끝낸다.
   프리뷰 배포는 쓰지 않는다 — Preview 환경에 비밀 변수가 없고 배포 보호(Vercel Authentication)로 302 되어 실기기 확인이 안 된다([[deploy-and-env]]).
7. **보고** — 배포가 끝난 상태에서 **사용자가 프로덕션 실기기에서 확인할 항목**을 짧게 적어 보고한다. 문제가 나오면 `fix/…` 브랜치로 후속 PR.

PR 게시 리뷰(`code-review <PR#>` + `review-reply`)는 사용자 명시 지시·타인 PR·별도 세션 크로스 체크에만 쓴다.

## 마무리 세트 (한 번에 끝까지)

merge 직후 같은 턴에서: 로컬 브랜치 삭제 → 원격 브랜치 삭제 확인 → 메인 체크아웃 `git pull --ff-only` + `git fetch --prune` → 워크트리를 썼으면 `git worktree remove`(미커밋 변경이 거부되면 `--force` 대신 내용 확인) →
Vercel 자동 배포 Ready 확인 → `main HEAD`·`git worktree list`·잔여 브랜치·개발 서버 종료 여부를 보고에 포함. 로그 엔트리(기록 의무 2)는 같은 PR 에 들어 있어야 한다.
PR 을 여러 개 낸 세션은 끝날 때 한 번 **위키 점검**: 오늘 엔트리의 PR 번호, 깨진 `[[링크]]`, 판정표·index 에 새 페이지·기능 경로가 있는지, 저장소에 비밀·개인 정보가 없는지(절대 규칙 1).

## 피드백 세션의 커밋 단위

사용자가 화면을 보며 연속으로 피드백을 주는 구간에서는 수정마다 커밋하지 않는다. 반영 → 검증 → (필요 시 배포) → 다음 피드백 대기를 반복하고,
피드백이 끝나는 시점에 의미 단위로 묶어 커밋한다. 예외: 규약 파일·비밀 보호처럼 되돌리기 민감한 변경은 즉시 커밋.
단, **main 에 직접 푸시한 배포본과 저장소가 어긋난 채로 두지 않는다** — 배포했으면 그 변경은 늦어도 그 세션 안에 커밋한다.

## 보고 형식

쉬운 말로, 이 순서로: ① 작업 배경 ② 작업 내역 ③ 결과(검증·측정, 실패도 그대로) ④ 이행 수준(완료/부분/보류) ⑤ 후속 작업(필요한 것만).
실기기에서만 확인 가능한 항목은 "미검증"으로 명시한다.

## 정본 위치

- 규약: 이 파일. Claude Code 전용 델타는 `CLAUDE.md`(어댑터), 개인 설정은 `CLAUDE.local.md`(미추적).
- 위키 루트: `docs/wiki/index.md` · 로그: `docs/wiki/log/index.md`
- 측정 기록: `docs/wiki/benchmarks.md` · 재현 스크립트: `scripts/bench/`
- 환경변수 목록: `.env.example` · 배포 설정: `vercel.json`
