# CLAUDE.md — 어댑터 (규약 본문은 AGENTS.md)

@AGENTS.md

Claude Code 전용 델타:

- Git 작업은 `/git-claw:commit` · `/git-claw:pr` 스킬로 한다(커밋 단위 분류·승인 절차 포함). 직접 `git commit` 으로 우회하지 않는다.
- 임시 파일·스크린샷·테스트 이미지는 세션 scratchpad 에만 둔다. 저장소 트리에 두지 않는다.
- 개발 서버(`pnpm dev`, 5173)를 띄웠으면 작업 종료 전에 반드시 내린다. 배포(`npx vercel --prod`)는 사용자가 요청했을 때만.
- 사용자에게 보이는 글과 코드 주석은 한국어. 모델 ID·API 필드 같은 식별자는 원문 유지.
