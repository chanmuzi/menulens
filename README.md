# MenuLens

일본 식당 메뉴판을 찍으면 한국어 번역·요리 설명·가격(원화 환산)·대표 이미지를 보여주는 모바일 웹 앱.
도트 감성 + 일본풍(和紙) 디자인.

## 구조

```
api/            Vercel Edge Functions (Web 표준 Request → Response)
  analyze.ts    이미지 → Upstage OCR(단어·좌표·글자 방향) → Timely Router(claude-sonnet-5-5) 텍스트 스트리밍 (NDJSON 중계)
  auth.ts       초대 코드 확인
  rate.ts       JPY→KRW 환율 (open.er-api.com, 12시간 캐시)
  photo.ts      대표 사진 검색 (Wikimedia Commons, 7일 캐시)
  _lib/         접근 제어, OCR 호출, 단어 묶음 분할, 항목 스트림 파서, 프롬프트, 응답 헬퍼
src/
  App.tsx       화면 상태 머신 (gate → home → processing → result)
  screens/      Gate, Home, Processing, Result(Overlay / Cards / ItemSheet)
  components/   PixelIcon, Segmented, ProgressBlocks, ItemImage, TopBar, MenuPhoto(회전·기울기 보정·글자 영역 확대)
  lib/          이미지 리사이즈(EXIF 보정), 스트리밍 JSON 파서, API 클라이언트, localStorage, 새 빌드 감지
  styles/       global.css(토큰·픽셀 프레임·애니메이션), pixel-icons.css(생성 파일)
scripts/px_icons.py   ASCII 스프라이트 → box-shadow 픽셀 아이콘 CSS 생성기
scripts/bench/        처리 시간 벤치마크 스크립트 (결과: docs/benchmarks.md)
vite-plugin-dev-api.ts  로컬에서 api/ 핸들러를 Vite 미들웨어로 실행 (Vercel CLI 불필요)
```

## 로컬 실행

```bash
cp .env.example .env   # TIMELY_API_KEY, UPSTAGE_API_KEY 입력. ACCESS_CODES 는 로컬에서 비워 두면 모두 통과
pnpm install
pnpm dev               # http://localhost:5173  (같은 Wi-Fi 의 휴대폰에선 Network 주소로 접속)
```

아이콘을 추가·수정했으면 `pnpm icons` 로 CSS 를 다시 생성한다.

## 배포 (Vercel, 무료 Hobby)

```bash
npx vercel            # 처음 한 번 로그인·프로젝트 연결
npx vercel env add TIMELY_API_KEY production
npx vercel env add UPSTAGE_API_KEY production
npx vercel env add ACCESS_CODES production   # 예: sakura-2026,kohaku-2026
npx vercel --prod
```

배포 환경에서는 `ACCESS_CODES` 에 등록된 초대 코드가 있어야만 분석 API 를 호출할 수 있다.
비어 있으면 모든 요청을 거부하므로, 키가 유출되거나 공개돼도 비용이 발생하지 않는다.

## 동작 흐름

1. 촬영/앨범 → 클라이언트에서 EXIF 방향을 바로잡고 긴 변 1280px JPEG 로 축소
2. `/api/analyze` 1단계: Upstage OCR 이 단어·좌표·글자 방향을 읽음 (≈3초). 처리 화면에 단어 상자가 바로 표시됨
3. 1단계 LLM: 단어 목록을 (많으면 묶음으로 나눠 병렬로) Sonnet 5.5 에 보내 이름·가격·좌표·아이콘만 받음. 목록이 완성되면 결과 화면으로 (실제 사진 34개 기준 ≈10초)
4. 2단계 LLM: 발음·설명·태그를 10개씩 병렬로 받아 카드에 뒤따라 채움 (≈+7초). 메뉴가 아닌 문구(제목·안내)도 번역
   OCR 이 단어를 거의 못 읽으면 이미지를 직접 보는 폴백
5. 결과: 카드 뷰(기본) / 오버레이 뷰(BETA, 표시 끄기 토글). 좌표는 OCR 단어 상자의 합집합이라 정확하고, 돌아간 사진은 자동으로 세움
6. 최근 스캔 5개는 기기(localStorage)에 저장. 새 빌드가 배포되면 앱이 열릴 때 스스로 새로고침

## 다음 과제

- 자주 나오는 메뉴 300~500개의 사진·설명 사전 구축 (Commons 검색 품질 보완, 현재 사진 토글은 비활성)
- 초대 코드별 일일 호출 한도 (무료 KV 필요)
- PWA manifest / 홈 화면 추가
