# MenuLens Wiki — Index (라우팅 루트)

> **탐색 시작점.** 작업 유형은 `AGENTS.md` 판정표로 정하고, 여기서 페이지 1~3장만 연다. 전체 grep 금지.

## 운영 파일

- [[log/index]] — 로그 라우팅 (월 샤드, 최신은 [[log/2026-10]])
- [[backlog]] — 남은 과제와 **사용자 결정 대기** 항목

## 페이지

- [[architecture]] — 구조와 파이프라인: 사진 → OCR(단어·좌표·방향) → 1단계 LLM(이름·가격·좌표, 병렬 묶음) → 2단계 LLM(설명, 캐시) → 화면. 파일 지도, NDJSON 이벤트, 검증 절차(헤드리스 Chrome 흐름)
- [[benchmarks]] — 처리 시간 측정 기록: Document Parse vs OCR, 모델 3종 비교, 2단 분리 전후. 재현 명령
- [[overlay-and-photo]] — 화면 좌표 규칙: OCR 단어 상자 합집합, EXIF·글자 방향·기울기 보정, 글자 영역 확대, 칩/배지/덮어쓰기 라벨 선택 규칙, 핀치 줌과 스크롤
- [[deploy-and-env]] — Vercel(Node 런타임, 도쿄, Git 자동 배포), 환경변수 5종, Redis Cloud 연결 경위, 초대 코드 게이트, 비용
- [[debug-store]] — 진단 저장: 켜는 법, 내려받기, 사용자 실기기 케이스 재현 절차, 끄는 시점
- [[design-decisions]] — 확정된 디자인·UX 결정(시안 A, 언어 규칙, 카드 기본·오버레이 BETA, 사진 모드 보류, 아이콘 규칙)과 폐기된 것
