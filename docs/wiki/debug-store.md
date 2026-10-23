# 진단 저장 (사용자 실기기 케이스 재현)

서버는 기본적으로 사진·결과를 남기지 않는다. `DEBUG_STORE=1` + `REDIS_URL` 이 있을 때만
`api/_lib/debugStore.ts` 가 스캔마다 `{사진(base64, ≤650KB), OCR 단어·방향·기울기, 1단계 항목, 문구, 묶음 수}` 를
`menulens:debug:<id>` 에 7일 TTL 로 저장하고 `menulens:debug:list` 에 최근 20건 id 를 유지한다.
목록에서 밀려나는 기록은 본문까지 함께 지운다(오래된 것부터). 그래도 용량 부족(OOM)으로 거부되면 오래된 것을 하나씩 더 지우고 다시 쓴다.
2026-10-23 이전에는 LTRIM 으로 id 만 빠지고 본문이 7일간 남아 93건·28.8MB 로 무료 30MB 가 찼고, 이후 진단 저장과 메뉴 설명 캐시(`menulens:detail`) 쓰기가 모두 조용히 실패했다(목록 밖 72건 삭제 후 5.7MB).

## 절차

1. 사용자가 문제 상황을 휴대폰으로 다시 찍는다 (배포본에서 `DEBUG_STORE=1` 상태).
2. 로컬에서 내려받기: `set -a && . ./.env && set +a && python3 scripts/bench/debug_pull.py <scratchpad>/debug_scans`
   → `<id>.json` + `<id>.jpg`. 표준 라이브러리만 쓴다(RESP 직접 구현).
3. `<id>.jpg` 를 로컬 `pnpm dev` + 헤드리스 Chrome 흐름에 넣어 화면을 재현한다([[architecture]] §검증).
4. 운용 기준(2026-10-20 결정): **혼자 테스트하는 동안은 켜 둔다**(문제가 난 순간의 스캔이 바로 남아 다시 찍을 필요가 없다). **초대 코드를 다른 사람에게 나눠주기 시작하면 끈다**(타인의 사진을 모르게 보관하지 않기 위해). 끄기: `printf 0 | npx vercel env add DEBUG_STORE production --force` 후 재배포. 내려받은 사진은 scratchpad 밖에 두지 않는다(절대 규칙 4·5).

## 사례

- 2026-10-20 야키토리 메뉴판(단어 69·항목 21): 긴 안내문 라벨이 사진을 가리는 문제를 이 경로로 재현·수정([[overlay-and-photo]]).
