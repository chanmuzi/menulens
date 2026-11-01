# 배포와 환경

## Vercel

> **배포 중단 중(2026-11-01, PR #74·#75)**: 저장소 공개를 앞두고 사용자 결정으로 프로덕션을 내렸다. `vercel.json` 에 `git.deploymentEnabled: false`(push 가 배포를 만들지 않음), GitHub 홈페이지 필드 비움.
> **단, 배포본만 지우려던 `vercel rm menulens` 가 Vercel 프로젝트를 통째로 삭제했다**(에이전트 실수. `vercel rm <프로젝트명>` 은 프로젝트 삭제다. 배포본 하나를 지우려면 배포 URL 을 넘겨야 한다). 사라진 것: 프로젝트, 프로덕션 환경변수, Git 연동, 도메인 `menulens-psi.vercel.app`. 남은 것: 환경변수 값은 전부 로컬 `.env`(미추적)에 있고, Redis Cloud 저장소는 프로젝트와 별개라 살아 있다(삭제 직후 1,426 키·6.75MB 확인). 아래 「프로젝트 `menulens`(Hobby). GitHub 연동」 서술은 되살릴 때까지 적용되지 않는다.
>
> **되살리기 절차**: ① 대시보드 Add New → Project 에서 `chanmuzi/menulens` import(이름 `menulens`, Vite 자동 인식) ② Settings → Environment Variables 에 `.env` 의 값을 Production 에 넣기(`printf '%s' "$값" | npx vercel env add 이름 production` 으로 화면에 값이 남지 않게. `REDIS_URL` 은 Storage 탭에서 기존 Redis 를 Connect 하거나 `.env` 값을 그대로) ③ `vercel.json` 의 `git.deploymentEnabled` 를 지우는 PR → merge 로 첫 배포 ④ 로컬 `.vercel/` 은 옛 프로젝트 id 라 `npx vercel link` 로 다시 연결 ⑤ 새 자동 도메인이 생기므로 휴대폰 홈 화면 앱은 다시 추가. 초대 코드 값은 그대로 써도 된다.

- 프로젝트 `menulens`(Hobby). GitHub `chanmuzi/menulens` 연동 → **main push = 프로덕션 배포**. `npx vercel` 직접 배포(프리뷰·`--prod`)는 쓰지 않는다. 프로덕션은 merge 로만(CLAUDE.md). 배포 상태는 `npx vercel api "/v6/deployments?projectId=menulens&target=production&limit=3"` 로 커밋별 READY 를 확인한다.
- **프리뷰 배포는 쓰지 않는다**(2026-10-21 결정). 브랜치 푸시마다 Vercel 이 프리뷰를 만들지만 ① Preview 환경에 `ACCESS_CODES`·`UPSTAGE_API_KEY`·`TIMELY_API_KEY` 가 없고(Production 전용)
  ② 배포 보호(Vercel Authentication)가 켜져 있어 모든 요청이 `vercel.com/sso-api` 로 302 된다. 그래서 실기기 확인은 merge 후 프로덕션에서 한다(AGENTS.md 「작업 완료 프로토콜」 6).
  프리뷰를 살리려면 대시보드에서 보호 해제·우회 토큰 발급·Preview 환경변수 추가가 필요한데, 모두 사용자 결정 사항(절대 규칙 3).
- 런타임: **Node.js**(2026-10-20 Edge 에서 전환). 이유: Redis TCP 필요, Edge 의 25초 첫 응답 제한 해제. `vercel.json` 에 리전 `hnd1`(도쿄)·`maxDuration 120`.
- Node ESM 주의: `api/` 의 상대 import 는 `.js` 확장자 필수(없으면 FUNCTION_INVOCATION_FAILED).
- **요청 취소**: Node 함수는 `vercel.json` `functions["api/*.ts"].supportsCancellation: true` 가 있어야 클라이언트가 끊었을 때 `request.signal` 이 abort 되고 함수가 종료된다(기본 꺼짐). `/api/analyze`·`/api/chat` 이 이 signal 을 상류 fetch 에 넘긴다. 참고: https://vercel.com/changelog/node-js-vercel-functions-now-support-per-path-request-cancellation
- iOS 홈 화면 앱은 시작 페이지를 오래 캐시한다 → 빌드마다 `version.json` 을 내고 앱이 열릴 때 비교해 다르면 1회 새로고침(`src/lib/version.ts`).

## 환경변수 (프로덕션)

| 이름 | 용도 | 비고 |
|---|---|---|
| `LLM_PROVIDER` | LLM 제공자 `timely`·`anthropic`·`openai`·`upstage`·`openrouter`. 비우면 키가 있는 순서(timely → anthropic → openai → upstage) | 아래 §LLM 제공자. 프로덕션은 비워 둠(= Timely) |
| `TIMELY_API_KEY` | LLM(Timely Router, Anthropic 호환) | 서버 전용 |
| `ANTHROPIC_API_KEY` | LLM(Anthropic 직접). 제공자가 Timely 일 때는 대화 통역의 **예비** 경로(402·429·한도 문구로 거절할 때만) | 서버 전용. auto-reload 끔(소진 시 호출만 멈춤) |
| `OPENAI_API_KEY` · `OPENROUTER_API_KEY` | 다른 LLM 제공자 키(쓸 때만) | 서버 전용 |
| `LLM_MODEL` · `LLM_ICON_MODEL` · `LLM_API_KEY` · `LLM_BASE_URL` | 제공자 기본값 덮어쓰기(모델, 아이콘 생성용 상위 모델, 키, 주소) | 선택 |
| `GROQ_API_KEY` | 대화 통역 음성 인식 기본(Groq Whisper) | 서버 전용. 무료 등급 |
| `GEMINI_API_KEY` | 음성 인식 예비(Gemini 받아쓰기 모델) | 서버 전용. 무료 등급(입력·출력이 Google 제품 개선에 쓰일 수 있음) |
| `UPSTAGE_API_KEY` | OCR. `LLM_PROVIDER=upstage` 면 Solar 의 키도 겸한다 | 서버 전용 |
| `ACCESS_CODES` | 초대 코드(쉼표 구분) | 배포 환경에서 비어 있으면 **전체 거부**. 실제 값은 문서에 쓰지 않는다 |
| `REDIS_URL` | 설명 캐시·진단 저장 | Vercel Storage 에서 Redis 추가 시 자동 등록 |
| `DEBUG_STORE` | `1` 이면 최근 스캔 보관 | 운용 기준은 [[debug-store]] |
| `VERCEL` | 배포 환경 판정(`api/_lib/access.ts`) | Vercel 이 자동 주입, 설정 불필요. 있으면 `ACCESS_CODES` 가 비었을 때 전부 거부 |

로컬은 `.env`(미추적)에 같은 이름. `pnpm dev` 가 읽는다.

## LLM 제공자 (2026-11-01, PR #72)

모든 LLM 호출은 `api/_lib/llm.ts` 하나로 간다. 공개 저장소를 따라 배포하는 사람이 Timely Router 계정 없이도 돌릴 수 있게 제공자를 환경변수로 뽑았다.

| `LLM_PROVIDER` | 형식 | 기본 모델 | 아이콘 상위 모델 | 이미지 입력 | 비고 |
|---|---|---|---|---|---|
| `timely` | Anthropic Messages | `claude-sonnet-5-5` | `claude-opus-5-5` | ○ | 프로덕션 현재값(변수 비움 = 이 경로) |
| `anthropic` | Anthropic Messages | `claude-sonnet-5-5` | `claude-opus-5-5` | ○ | **README 권장**. 키 하나로 전 기능 |
| `openai` | OpenAI Chat Completions | `gpt-5.4-mini` | (기본 모델) | ○ | `reasoning_effort: low` |
| `upstage` | OpenAI Chat Completions | `solar-pro4` | (기본 모델) | ✕ | OCR 과 같은 키 하나로 OCR + LLM. 글자가 없는 사진은 분석 불가(`no_vision`), 챗은 사진 없이, 도트 아이콘 생성은 격자 형식을 잘 못 지켜 기본 아이콘으로 남는다 |
| `openrouter` | Anthropic Messages(Bearer) | 없음(`LLM_MODEL` 필수) | 없음 | ○ | 미검증 |

- 사고는 `think`: 'low'(Anthropic adaptive + effort low / OpenAI reasoning_effort low / Solar 는 추론 끔) · 'off'(Anthropic between_tools, 번역·제목). 2026-11-01 합성 메뉴판 14항목 스모크: 네 제공자 모두 항목 14·설명 14·묶음 4~6, 목록 완성 6.4~11.5초([[benchmarks]]).
- 예비 경로는 바뀌지 않았다: 기본이 `timely` 이고 `ANTHROPIC_API_KEY` 가 있으면 대화 통역(`/api/talk`)만 한도 응답에 Anthropic 직접으로 한 번 더. 다른 엔드포인트에 붙이는 건 비용 결정 사항(절대 규칙 3).
- 제공자가 하나도 없으면 분석·챗·아이콘·통역 API 가 500 과 설정 안내 문구를 돌려준다.

## Redis 연결 경위 (2026-10-20)

- 사용자가 Vercel Storage → Create Database 에서 **Redis Cloud**(Redis Inc.) Free 30MB, Seoul 을 선택. Upstash 가 아니라 REST API 가 없고 `REDIS_URL`(redis://, TCP 13437) 만 생김.
- Edge 는 TCP 불가 → Node 런타임 전환 + `redis`(node-redis 4) 로 접속(`api/_lib/kv.ts`). 접속 실패·미설정 시 캐시·진단은 조용히 건너뛴다.
- Free 플랜은 persistence 없음(재시작 시 비워질 수 있음) — 캐시·진단 용도라 허용.

## Redis 키·용량 (Free 30MB, `maxmemory-policy noeviction`)

| 키 | 용도 | 보관 |
|---|---|---|
| `menulens:detail:v1:*` | 메뉴 설명 캐시(`api/_lib/cache.ts`). 일→한은 `v1:<이름>`, 그 밖의 방향은 `v1:<src>-<dst>:<이름>`(2026-10-31) | 180일 |
| `menulens:icon:v1:*` | 생성 아이콘 격자(`api/_lib/iconCache.ts`) | 365일 |
| `menulens:debug:*` + `menulens:debug:list` | 진단 저장 최대 20건(사진 포함) | 7일, 밀려나면 본문도 삭제([[debug-store]]) |

- **가득 차면 새 쓰기가 조용히 실패한다**(모든 kv 호출이 오류를 삼킴). 2026-10-23 진단 기록 본문이 쌓여 30MB 가 찼고 설명 캐시까지 멈췄던 사례(PR #43). 의심되면 `INFO memory` 의 `used_memory_human` 과 키 접두사별 `MEMORY USAGE` 를 본다(읽기 전용, RESP 는 `scripts/bench/debug_pull.py` 방식).

## 비용

- 호출당 과금은 LLM(제공자별 단가) 뿐. OCR 은 Upstage 키 과금 정책을 따른다. Vercel Hobby·Redis Free 는 무료 범위.
- 대화 통역(2026-10-23 사용자 결정): 음성 인식은 무료 등급만 쓴다. 번역·도우미는 Timely(호출당 과금), 한도 문제일 때만 Anthropic 직접 키(Max 크레딧).
  - **Groq 무료 한도**(응답 헤더 실측, 모델별): 요청 2,000회/일, 오디오 7,200초/시간. 일 오디오 상한(28,800초설)은 헤더에 안 나와 미확인. 10초 미만 요청도 10초로 센다(공식 문서).
  - **Gemini 무료 한도**: 받아쓰기 모델 `gemini-3.5-transcribe` 분당 3회(429 응답 문구 실측). 그 밖의 수치는 AI Studio 에서만 보인다(문서 미기재).
  - 둘 다 안 되면 `/api/stt` 가 503 `stt_unavailable` 과 `retryAfter`(한도라서 다시 될 때까지의 초를 알면, 아니면 null)를 준다. 클라이언트는 시간을 알면 「N분 뒤」, 모르면 「관리자에게 문의」 안내.
- 초대 코드 게이트가 없으면 키가 공개 노출되는 셈이므로 `ACCESS_CODES` 를 비우지 않는다.

## 초대 코드 운용

- 실제 값은 **Vercel 프로덕션 환경변수와 로컬 `.env`(미추적) 두 곳에만** 둔다. 위키·커밋·PR·`CLAUDE.local.md`·대화에 값을 쓰지 않는다. 에이전트는 스모크 때 `.env` 에서 읽어 쓴다(`${ACCESS_CODES%%,*}`, 값은 출력하지 않음) — 값을 기억하거나 사용자에게 매번 물을 필요가 없다.
- 저장소는 공개라 계정명·프로젝트명처럼 저장소에서 보이는 문자열을 그대로 코드로 쓰지 않는다. 2026-10-23 계정명과 같던 코드를 교체(사용자 결정: 친구에게 알려줄 짧은 값으로, 외부인이 저장소를 뒤져 바로 찾지 못하면 충분).
- 바꾸는 법: `.env` 의 `ACCESS_CODES` 를 고친 뒤 그 값을 `printf '%s' "$ACCESS_CODES" | npx vercel env add ACCESS_CODES production --force` 로 넣고(값이 화면·로그에 남지 않게), 다음 merge 배포로 반영. 반영 후 옛 코드가 401 인지, `.env` 값이 200 인지 확인한다. 앱은 열릴 때 저장된 코드를 `/api/auth` 로 확인해 401 이면 게이트 화면을 다시 띄운다(`src/App.tsx`, 2026-10-23 추가. 그 전에는 분석 요청이 거절될 때만 게이트로 갔다).
