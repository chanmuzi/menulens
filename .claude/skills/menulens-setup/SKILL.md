---
name: menulens-setup
description: MenuLens 를 처음 세팅할 때 쓴다(이 저장소를 클론한 사람의 온보딩). 어떤 기능을 쓸지·어떤 LLM 제공자·어떤 API 키가 필요한지 인터뷰하고, 키 입력은 `pnpm bootstrap` 터미널 마법사에 맡기고, 결과를 확인하고, 로컬 실행과 Vercel 배포까지 안내한다. "세팅", "setup", "API 키 어디에", "배포 준비", "처음 실행" 같은 요청에 쓴다.
---

# MenuLens 처음 세팅 (에이전트 절차)

이 스킬은 **결정과 안내**를 맡고, **키 입력과 검증·저장·배포는 `pnpm bootstrap`**(`scripts/bootstrap/`)이 맡는다. 두 가지 이유다.
1. API 키 값을 채팅에 치면 대화 기록에 남는다. 마법사는 터미널에서 화면에 안 보이게 받고 `.env`(미추적, 권한 600)에만 쓴다.
2. 마법사는 사람이 에이전트 없이도 돌릴 수 있고, 다른 에이전트도 같은 절차를 쓴다.

## 절대 규칙

- **키 값을 묻지 않는다. 사용자가 채팅에 키를 붙여 넣으면 그 키는 노출된 것으로 보고, 발급처에서 폐기하고 새로 만들라고 안내한다.**
- `.env` 를 읽어야 하면 변수 **이름**만 본다(`grep -oE '^[A-Z_]+' .env`). 값은 출력하지 않는다. 확인은 `pnpm bootstrap --check` 가 마스킹해서 보여 준다.
- 키 발급·Vercel 가입·로그인은 사용자가 직접 한다. 에이전트는 링크와 다음 할 일을 준다.

## 1. 인터뷰 (선택형 질문 3개)

AskUserQuestion 이 있으면 그걸로, 없으면 글로 묻는다. 답을 모아 두었다가 마법사의 질문 순서대로 "이렇게 답하시면 됩니다"로 돌려준다.

| 질문 | 선택지 | 결과 |
|---|---|---|
| 어디까지 쓰실 건가요? | ① 사진 읽기만(메뉴판·안내문 번역, 주문서, 챗) ② 사진 읽기 + 대화 통역(음성 인식) | ②면 Groq 키가 더 필요하다(무료), Gemini 는 선택 |
| LLM 제공자 | ① Anthropic(권장, 키 하나로 전 기능) ② OpenAI ③ Upstage Solar(OCR 과 같은 키 하나, 글자 없는 사진은 못 읽음, 아이콘 생성은 기본 아이콘) ④ Timely Router | 그 제공자의 키 1개 |
| 지금 Vercel 에 배포할까요? | ① 예(계정 있음) ② 예(계정 없음 → 가입 안내) ③ 로컬에서만 | ①은 `npx vercel login` 을 먼저 하게 한다 |

필요한 키와 발급처를 한 번에 보여 준다(마법사도 같은 안내를 한다).

| 키 | 언제 | 발급처 |
|---|---|---|
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `TIMELY_API_KEY` | 고른 제공자 | console.anthropic.com / platform.openai.com/api-keys / timelyrouter.ai |
| `UPSTAGE_API_KEY` | 항상 권장(Document OCR). Solar 를 고르면 LLM 키도 겸함 | console.upstage.ai → API Keys |
| `GROQ_API_KEY` | 대화 통역 | console.groq.com/keys (무료 등급) |
| `GEMINI_API_KEY` | 대화 통역, 선택(예비 음성 인식) | aistudio.google.com/apikey |
| `ACCESS_CODES` | 배포할 때 | 직접 정함. 마법사가 후보를 제안한다 |
| `REDIS_URL` | 선택 | Vercel Storage 에서 Redis 추가 시 자동 |

## 2. 마법사 실행 (사용자가 직접)

**별도 터미널**에서 `pnpm install && pnpm bootstrap` 을 돌리게 한다. 터미널(TTY)에서는 키 입력이 화면에 찍히지 않는다. Claude Code 의 `! pnpm bootstrap` 은 출력이 대화 기록에 들어가고 stdin 이 TTY 가 아닐 수 있어(그러면 숨김이 꺼진다) 키 입력 단계에는 권하지 않는다. 끝난 뒤 결과만 `pnpm bootstrap --check` 로 가져온다.

마법사 순서: 기능 → 제공자 → 키(하나씩 확인) → 초대 코드 → Redis → `.env` 저장 → Vercel(선택). 다시 실행하면 기존 값을 보여 주고 Enter 로 유지한다. 에이전트는 **실행하지 않고** 사용자가 끝내길 기다린다(stdin 이 필요하다).

Vercel 을 고른 경우 마법사는 `npx vercel project add` → `vercel link` → `vercel env add`(값은 stdin) → `vercel git connect` → `vercel deploy --prod` → `/api/rate`·`/api/auth` 스모크 순으로 진행하고 배포 주소를 출력한다.

## 3. 확인 (에이전트가 실행)

```bash
pnpm bootstrap --check      # 키 생존·Redis 연결·제공자·초대 코드 요약(값은 마스킹)
pnpm build                  # tsc + vite
```

둘 다 통과하면 `pnpm dev` 를 띄우고 `curl -s localhost:5173/api/rate` 가 200 인지, `POST /api/auth` 에 초대 코드를 보내 200 인지 본 뒤 **서버를 내린다**. 사진 분석은 사용자가 휴대폰이나 브라우저에서 한 장 올려 보게 한다(모델 호출 비용이 드니 에이전트가 반복하지 않는다).

## 4. 자주 막히는 곳

| 증상 | 원인 | 안내 |
|---|---|---|
| `--check` 에서 어떤 키가 ✗ HTTP 401 | 키가 틀렸거나 권한 없음 | 발급처에서 새 키. 마법사 재실행 후 그 키만 다시 입력(나머지는 Enter) |
| 배포는 됐는데 분석이 401 | 배포 환경 `ACCESS_CODES` 가 비었거나 앱에 넣은 코드가 다름 | Vercel Settings → Environment Variables 확인 후 Redeploy |
| `npx vercel whoami` 실패 | 로그인 안 됨 | `npx vercel login` 뒤 `pnpm bootstrap` 재실행(값 유지) |
| `vercel git connect` 실패 | Vercel 의 GitHub 앱이 저장소에 설치되지 않음 | 마법사의 첫 배포는 이미 됐으니 대시보드 Settings → Git 에서 연결하면 그다음부터 main push 로 배포된다 |
| 사진이 「글자를 찾지 못했어요」 | OCR 키가 없거나 Solar 제공자 | `UPSTAGE_API_KEY` 추가, 또는 이미지 입력 되는 제공자로 |
| 분석이 느리고 비쌈 | `UPSTAGE_API_KEY` 없이 이미지 폴백만 | OCR 키 추가 |

## 5. 끝낼 때 알려 줄 것

- 휴대폰 브라우저로 배포 주소를 열고 초대 코드를 넣은 뒤 **홈 화면에 추가**.
- 다른 사람에게 코드를 나눠 주기 전에 `DEBUG_STORE` 는 비워 둔다(켜면 사진이 7일간 Redis 에 남는다).
- 초대 코드를 아는 사람은 내 키로 호출한다. 호출 한도는 아직 없다(`docs/wiki/backlog.md`).
- 더 자세한 배포·환경변수 설명은 `docs/wiki/deploy-and-env.md`, 구조는 `docs/wiki/architecture.md`.
