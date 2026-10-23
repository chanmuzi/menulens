# 배포와 환경

## Vercel

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
| `TIMELY_API_KEY` | LLM(Timely Router) | 서버 전용 |
| `UPSTAGE_API_KEY` | OCR | 서버 전용 |
| `ACCESS_CODES` | 초대 코드(쉼표 구분) | 배포 환경에서 비어 있으면 **전체 거부**. 실제 값은 문서에 쓰지 않는다 |
| `REDIS_URL` | 설명 캐시·진단 저장 | Vercel Storage 에서 Redis 추가 시 자동 등록 |
| `DEBUG_STORE` | `1` 이면 최근 스캔 보관 | 운용 기준은 [[debug-store]] |
| `VERCEL` | 배포 환경 판정(`api/_lib/access.ts`) | Vercel 이 자동 주입, 설정 불필요. 있으면 `ACCESS_CODES` 가 비었을 때 전부 거부 |

로컬은 `.env`(미추적)에 같은 이름. `pnpm dev` 가 읽는다.

## Redis 연결 경위 (2026-10-20)

- 사용자가 Vercel Storage → Create Database 에서 **Redis Cloud**(Redis Inc.) Free 30MB, Seoul 을 선택. Upstash 가 아니라 REST API 가 없고 `REDIS_URL`(redis://, TCP 13437) 만 생김.
- Edge 는 TCP 불가 → Node 런타임 전환 + `redis`(node-redis 4) 로 접속(`api/_lib/kv.ts`). 접속 실패·미설정 시 캐시·진단은 조용히 건너뛴다.
- Free 플랜은 persistence 없음(재시작 시 비워질 수 있음) — 캐시·진단 용도라 허용.

## Redis 키·용량 (Free 30MB, `maxmemory-policy noeviction`)

| 키 | 용도 | 보관 |
|---|---|---|
| `menulens:detail:v1:*` | 메뉴 설명 캐시(`api/_lib/cache.ts`) | 180일 |
| `menulens:icon:v1:*` | 생성 아이콘 격자(`api/_lib/iconCache.ts`) | 365일 |
| `menulens:debug:*` + `menulens:debug:list` | 진단 저장 최대 20건(사진 포함) | 7일, 밀려나면 본문도 삭제([[debug-store]]) |

- **가득 차면 새 쓰기가 조용히 실패한다**(모든 kv 호출이 오류를 삼킴). 2026-10-23 진단 기록 본문이 쌓여 30MB 가 찼고 설명 캐시까지 멈췄던 사례(PR #43). 의심되면 `INFO memory` 의 `used_memory_human` 과 키 접두사별 `MEMORY USAGE` 를 본다(읽기 전용, RESP 는 `scripts/bench/debug_pull.py` 방식).

## 비용

- 호출당 과금은 LLM(Sonnet) 뿐. OCR 은 Upstage 키 과금 정책을 따른다. Vercel Hobby·Redis Free 는 무료 범위.
- 초대 코드 게이트가 없으면 키가 공개 노출되는 셈이므로 `ACCESS_CODES` 를 비우지 않는다.

## 초대 코드 운용

- 실제 값은 **Vercel 프로덕션 환경변수와 로컬 `.env`(미추적) 두 곳에만** 둔다. 위키·커밋·PR·`CLAUDE.local.md`·대화에 값을 쓰지 않는다. 에이전트는 스모크 때 `.env` 에서 읽어 쓴다(`${ACCESS_CODES%%,*}`, 값은 출력하지 않음) — 값을 기억하거나 사용자에게 매번 물을 필요가 없다.
- 저장소는 공개라 계정명·프로젝트명처럼 저장소에서 보이는 문자열을 그대로 코드로 쓰지 않는다. 2026-10-23 계정명과 같던 코드를 교체(사용자 결정: 친구에게 알려줄 짧은 값으로, 외부인이 저장소를 뒤져 바로 찾지 못하면 충분).
- 바꾸는 법: `.env` 의 `ACCESS_CODES` 를 고친 뒤 그 값을 `printf '%s' "$ACCESS_CODES" | npx vercel env add ACCESS_CODES production --force` 로 넣고(값이 화면·로그에 남지 않게), 다음 merge 배포로 반영. 반영 후 옛 코드가 401 인지, `.env` 값이 200 인지 확인한다. 앱은 열릴 때 저장된 코드를  로 확인해 401 이면 게이트 화면을 다시 띄운다(, 2026-10-23 추가. 그 전에는 분석 요청이 거절될 때만 게이트로 갔다).
