# MenuLens

식당 메뉴판·안내문을 찍으면 읽어주는 개인 모바일 웹 앱. 한국인 여행객은 일본어 사진을 한국어로, 일본인 여행객은 한국어 사진을 일본어로(홈 오른쪽 위 버튼으로 앱 언어 전환, 사진 원문 언어는 자동 판정).
메뉴판은 번역·요리 설명·가격(환산)·도트 아이콘·주문서·챗, 안내문은 사진 위 문단 덮개와 요약·번역문·원문. 대화 통역(말하기·크게 보여주기·도우미)도 양방향. 발음은 모델이 아니라 규칙으로 만든다.
도트 감성 + 일본풍(和紙) 디자인.

구조·결정·측정은 이 파일에 옮겨 적지 않는다(낡기 쉬워서). 아래 정본을 본다.

- 작업 규약과 작업 유형별 진입 경로: `AGENTS.md`
- 위키 루트: `docs/wiki/index.md` — 구조·파일 지도(`architecture`), 화면 결정(`design-decisions` 와 하위 두 장), 배포·환경변수·Redis(`deploy-and-env`), 측정(`benchmarks`), 남은 과제(`backlog`)
- 작업 로그: `docs/wiki/log/` (월 샤드, 최신이 위)

## 로컬 실행

```bash
cp .env.example .env   # TIMELY_API_KEY, UPSTAGE_API_KEY 입력. ACCESS_CODES 는 로컬에서 비워 두면 모두 통과
pnpm install
pnpm dev               # http://localhost:5173  (같은 Wi-Fi 의 휴대폰에선 Network 주소로 접속)
pnpm build             # tsc + vite 빌드. 푸시 전 필수
```

아이콘을 추가·수정했으면 `pnpm icons` 로 CSS 를 다시 생성한다.

## 배포

Vercel Git 연동: **main 에 merge 되면 프로덕션에 자동 배포**된다. `npx vercel` 로 직접 배포(프리뷰·`--prod`)하지 않는다.
환경변수 목록은 `.env.example` 과 `docs/wiki/deploy-and-env.md`. 배포 환경에서는 `ACCESS_CODES` 의 초대 코드가 있어야 분석 API 를 쓸 수 있고, 비어 있으면 모두 거부한다.

## 라이선스

MIT. `LICENSE` 참고.
