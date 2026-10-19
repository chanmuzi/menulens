# MenuLens

일본 식당 메뉴판을 찍으면 한국어 번역·요리 설명·가격(원화 환산)·대표 이미지를 보여주는 모바일 웹 앱.
도트 감성 + 일본풍(和紙) 디자인.

## 구조

```
api/            Vercel Edge Functions (Web 표준 Request → Response)
  analyze.ts    메뉴판 이미지 → Timely Router(claude-opus-5-5) 스트리밍 → 텍스트 델타 전달
  auth.ts       초대 코드 확인
  rate.ts       JPY→KRW 환율 (open.er-api.com, 12시간 캐시)
  photo.ts      대표 사진 검색 (Wikimedia Commons, 7일 캐시)
  _lib/         접근 제어, 프롬프트, 응답 헬퍼
src/
  App.tsx       화면 상태 머신 (gate → home → processing → result)
  screens/      Gate, Home, Processing, Result(Overlay / Cards / ItemSheet)
  components/   PixelIcon, Segmented, ProgressBlocks, ItemImage, TopBar
  lib/          이미지 리사이즈, 스트리밍 JSON 파서, API 클라이언트, localStorage
  styles/       global.css(토큰·픽셀 프레임·애니메이션), pixel-icons.css(생성 파일)
scripts/px_icons.py   ASCII 스프라이트 → box-shadow 픽셀 아이콘 CSS 생성기
vite-plugin-dev-api.ts  로컬에서 api/ 핸들러를 Vite 미들웨어로 실행 (Vercel CLI 불필요)
```

## 로컬 실행

```bash
cp .env.example .env   # TIMELY_API_KEY 입력. ACCESS_CODES 는 로컬에서 비워 두면 모두 통과
pnpm install
pnpm dev               # http://localhost:5173  (같은 Wi-Fi 의 휴대폰에선 Network 주소로 접속)
```

아이콘을 추가·수정했으면 `pnpm icons` 로 CSS 를 다시 생성한다.

## 배포 (Vercel, 무료 Hobby)

```bash
npx vercel            # 처음 한 번 로그인·프로젝트 연결
npx vercel env add TIMELY_API_KEY production
npx vercel env add ACCESS_CODES production   # 예: sakura-2026,kohaku-2026
npx vercel --prod
```

배포 환경에서는 `ACCESS_CODES` 에 등록된 초대 코드가 있어야만 분석 API 를 호출할 수 있다.
비어 있으면 모든 요청을 거부하므로, 키가 유출되거나 공개돼도 비용이 발생하지 않는다.

## 동작 흐름

1. 촬영/앨범 → 클라이언트에서 긴 변 1280px JPEG 로 축소
2. `/api/analyze` 가 Opus 5.5 에 스트리밍 요청 → 항목이 완성되는 대로 화면에 칩이 붙음
3. 결과: 오버레이 뷰(사진 위 번역 칩) / 카드 뷰(그림·사진 토글, 기본 그림)
4. 최근 스캔 5개는 기기(localStorage)에 저장

## 다음 과제

- 자주 나오는 메뉴 300~500개의 사진·설명 사전 구축 (Commons 검색 품질 보완)
- 초대 코드별 일일 호출 한도 (무료 KV 필요)
- PWA manifest / 홈 화면 추가
