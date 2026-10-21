# 배포와 환경

## Vercel

- 프로젝트 `menulens`(Hobby). GitHub `chanmuzi/menulens` 연동 → **main push = 프로덕션 배포**. CLI `npx vercel --prod` 도 가능.
- **프리뷰 배포는 쓰지 않는다**(2026-10-21 결정). 브랜치 푸시마다 Vercel 이 프리뷰를 만들지만 ① Preview 환경에 `ACCESS_CODES`·`UPSTAGE_API_KEY`·`TIMELY_API_KEY` 가 없고(Production 전용)
  ② 배포 보호(Vercel Authentication)가 켜져 있어 모든 요청이 `vercel.com/sso-api` 로 302 된다. 그래서 실기기 확인은 merge 후 프로덕션에서 한다(AGENTS.md 「작업 완료 프로토콜」 6).
  프리뷰를 살리려면 대시보드에서 보호 해제·우회 토큰 발급·Preview 환경변수 추가가 필요한데, 모두 사용자 결정 사항(절대 규칙 3).
- 런타임: **Node.js**(2026-10-20 Edge 에서 전환). 이유: Redis TCP 필요, Edge 의 25초 첫 응답 제한 해제. `vercel.json` 에 리전 `hnd1`(도쿄)·`maxDuration 120`.
- Node ESM 주의: `api/` 의 상대 import 는 `.js` 확장자 필수(없으면 FUNCTION_INVOCATION_FAILED).
- iOS 홈 화면 앱은 시작 페이지를 오래 캐시한다 → 빌드마다 `version.json` 을 내고 앱이 열릴 때 비교해 다르면 1회 새로고침(`src/lib/version.ts`).

## 환경변수 (프로덕션)

| 이름 | 용도 | 비고 |
|---|---|---|
| `TIMELY_API_KEY` | LLM(Timely Router) | 서버 전용 |
| `UPSTAGE_API_KEY` | OCR | 서버 전용 |
| `ACCESS_CODES` | 초대 코드(쉼표 구분) | 배포 환경에서 비어 있으면 **전체 거부**. 실제 값은 문서에 쓰지 않는다 |
| `REDIS_URL` | 설명 캐시·진단 저장 | Vercel Storage 에서 Redis 추가 시 자동 등록 |
| `DEBUG_STORE` | `1` 이면 최근 스캔 보관 | 분석 끝나면 `0` |

로컬은 `.env`(미추적)에 같은 이름. `pnpm dev` 가 읽는다.

## Redis 연결 경위 (2026-10-20)

- 사용자가 Vercel Storage → Create Database 에서 **Redis Cloud**(Redis Inc.) Free 30MB, Seoul 을 선택. Upstash 가 아니라 REST API 가 없고 `REDIS_URL`(redis://, TCP 13437) 만 생김.
- Edge 는 TCP 불가 → Node 런타임 전환 + `redis`(node-redis 4) 로 접속(`api/_lib/kv.ts`). 접속 실패·미설정 시 캐시·진단은 조용히 건너뛴다.
- Free 플랜은 persistence 없음(재시작 시 비워질 수 있음) — 캐시·진단 용도라 허용.

## 비용

- 호출당 과금은 LLM(Sonnet) 뿐. OCR 은 Upstage 키 과금 정책을 따른다. Vercel Hobby·Redis Free 는 무료 범위.
- 초대 코드 게이트가 없으면 키가 공개 노출되는 셈이므로 `ACCESS_CODES` 를 비우지 않는다.
