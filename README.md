# MenuLens

식당 메뉴판이나 안내문을 찍으면 읽어 주는 개인용 모바일 웹 앱입니다. 한국인 여행객은 일본어 사진을 한국어로, 일본인 여행객은 한국어 사진을 일본어로 읽습니다(홈 오른쪽 위 버튼으로 앱 언어 전환, 사진의 원문 언어는 자동 판정). 일본 여행 중에 직접 쓰려고 만들었고, 같은 구성으로 누구나 자기 키와 자기 Vercel 계정으로 배포할 수 있게 공개합니다.

[English summary](#english-summary)

## 무엇을 하나

- **메뉴판**: 사진 위에 번호 배지를 얹은 오버레이와 카드 보기. 항목마다 번역, 요리 설명, 가격과 환산(¥↔₩), 도트 아이콘. 수량을 고르면 점원에게 보여 줄 주문 문구(원문 + 발음)를 만들어 줍니다. 사진에 대해 챗으로 물어볼 수 있습니다.
- **안내문·표지판**: 사진 위 문단별 번역 덮개, 요약과 팁, 번역문·원문 탭.
- **대화 통역**: 말하거나 글로 쓰면 상대 언어로 번역해 크게 보여 줍니다. 발음은 모델이 짓지 않고 규칙(가나↔한글)으로 만듭니다. 상황을 물어볼 수 있는 도우미가 붙어 있습니다.
- **기록**: 찍은 사진과 결과는 기기(IndexedDB)에만 저장됩니다. 서버는 사진을 남기지 않습니다(진단 저장을 켠 경우만 예외, 아래 비용·개인정보 참고).
- 디자인은 도트 감성에 일본풍 종이색입니다. iOS 홈 화면 앱으로 쓰는 것을 기준으로 만들었습니다.

## 어떻게 동작하나

```
사진 → Upstage Document OCR(단어·좌표·방향)
     → LLM 1단계: 단어 목록을 항목(이름·가격·좌표·아이콘)으로 구조화 (스트리밍, 항목이 생기는 대로 화면에)
     → LLM 2단계: 항목 10개씩 병렬로 설명·읽기 (Redis 캐시)
대화 → Groq Whisper(예비 Gemini) 음성 인식 → 같은 LLM 번역 → 규칙 발음
```

OCR 이 글자를 거의 못 찾을 때만 이미지를 모델에 직접 보여 주는 폴백으로 갑니다. 그래서 LLM 은 대부분 글자만 받고, 이미지 입력은 폴백과 챗에서 사진이 필요할 때만 씁니다. 자세한 구조는 `docs/wiki/architecture.md`, 측정은 `docs/wiki/benchmarks.md`.

## 준비물

| 항목 | 필요 | 어디서 | 비고 |
|---|---|---|---|
| **LLM 키** | 필수 | [Anthropic Console](https://console.anthropic.com) 권장 | 기본 `claude-sonnet-5-5`. 키 하나로 사진 폴백과 사진 챗까지 전부 동작합니다. OpenAI(`gpt-5.4-mini`), Upstage Solar(`solar-pro4`), Timely Router 로 바꿀 수 있습니다(아래 제공자 표) |
| **Upstage API 키** | 사실상 필수 | [Upstage Console](https://console.upstage.ai) | Document OCR. 없으면 모든 사진을 이미지 폴백으로만 읽어 느리고 비쌉니다 |
| Groq API 키 | 대화 통역 쓸 때 | [Groq Console](https://console.groq.com) | 음성 인식(Whisper). 무료 등급으로 충분합니다 |
| Gemini API 키 | 선택 | [Google AI Studio](https://aistudio.google.com) | 음성 인식 예비 경로. 무료 등급(입력이 Google 제품 개선에 쓰일 수 있음) |
| Vercel 계정 | 배포할 때 | [vercel.com](https://vercel.com) | Hobby 무료. 로컬에서만 쓰면 필요 없습니다 |
| Redis | 선택 | Vercel Storage 에서 Redis Cloud Free(30MB) | 요리 설명 캐시, 생성 아이콘 캐시. 없어도 동작합니다 |
| 초대 코드 | 배포할 때 | 직접 정함 | 공개 URL 에 아무나 들어와 내 키로 호출하지 못하게 막는 간단한 게이트 |

실행 환경: Node.js 22, pnpm 10. 아이콘 생성 스크립트와 벤치 스크립트만 Python 3 + Pillow 를 씁니다(앱 실행에는 필요 없음).

### LLM 제공자 고르기

`LLM_PROVIDER` 하나로 바꿉니다. 비워 두면 키가 있는 순서(timely → anthropic → openai → upstage)로 고릅니다.

| `LLM_PROVIDER` | 키 | 기본 모델 | 이미지 입력 | 비고 |
|---|---|---|---|---|
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-5-5` | ○ | **권장**. 전 기능 |
| `openai` | `OPENAI_API_KEY` | `gpt-5.4-mini` | ○ | 전 기능 |
| `upstage` | `UPSTAGE_API_KEY`(OCR 과 같은 키) | `solar-pro4` | ✕ | **키 하나로 OCR + LLM**. 글자가 없는 사진은 분석하지 못하고, 챗은 사진 없이 답하고, 도트 아이콘 생성은 기본 아이콘으로 남습니다 |
| `timely` | `TIMELY_API_KEY` | `claude-sonnet-5-5` | ○ | Anthropic 호환 라우터 |
| `openrouter` | `OPENROUTER_API_KEY` + `LLM_MODEL` | 없음 | ○ | Anthropic 호환 경로. 미검증 |

모델은 `LLM_MODEL`, 아이콘 생성용 상위 모델은 `LLM_ICON_MODEL`, 주소는 `LLM_BASE_URL` 로 덮어쓸 수 있습니다. 네 제공자(anthropic, openai, upstage, timely)는 같은 합성 메뉴판으로 끝까지 도는 것을 확인했습니다. 품질 비교는 하지 않았습니다.

## 로컬 실행

```bash
git clone https://github.com/chanmuzi/menulens.git && cd menulens
cp .env.example .env   # ANTHROPIC_API_KEY 와 UPSTAGE_API_KEY 를 채운다. ACCESS_CODES 는 로컬에서 비워 두면 모두 통과
pnpm install
pnpm dev               # http://localhost:5173  (같은 Wi-Fi 의 휴대폰에선 터미널에 뜨는 Network 주소로 접속)
pnpm build             # tsc + vite 빌드. 푸시 전 필수
```

`pnpm dev` 가 `api/` 의 서버 함수를 같은 프로세스에서 돌리므로 Vercel CLI 없이 전체 흐름을 로컬에서 볼 수 있습니다. 아이콘을 추가하거나 고쳤으면 `pnpm icons` 로 CSS 를 다시 만듭니다.

## Vercel 에 배포하기

1. 이 저장소를 fork 합니다.
2. Vercel 대시보드에서 **Add New → Project** 로 fork 를 import 합니다. 프레임워크는 Vite 로 자동 인식되고, 서버 함수는 `api/` 폴더에서 자동으로 잡힙니다(`vercel.json` 에 리전 도쿄 `hnd1`, 함수 120초, 요청 취소 설정이 들어 있습니다. 리전은 자기 여행지에 가깝게 바꾸세요).
3. **Settings → Environment Variables** 에 `.env.example` 의 항목을 넣습니다. 최소 구성은 `ANTHROPIC_API_KEY`, `UPSTAGE_API_KEY`, `ACCESS_CODES` 셋입니다. Production 환경에 넣으세요(Preview 는 쓰지 않습니다).
4. (선택) **Storage → Create Database → Redis** 를 추가하면 `REDIS_URL` 이 자동으로 들어갑니다.
5. Deploy. 이후에는 `main` 에 push 될 때마다 자동으로 다시 배포됩니다.
6. 휴대폰 브라우저로 배포 주소를 열고 초대 코드를 넣은 뒤 **홈 화면에 추가**하면 앱처럼 씁니다.

`ACCESS_CODES` 가 비어 있으면 배포 환경에서는 모든 분석 요청을 거부합니다. 공개 주소에 아무나 들어와 내 키로 호출하는 것을 막기 위한 장치이니, 저장소에서 보이는 문자열(계정명, 프로젝트명, 예시 값)은 피해서 정하세요.

## 비용과 개인정보

- 호출당 과금은 LLM 과 OCR 뿐입니다. 메뉴판 한 장에 LLM 호출이 1단계 1~4회(단어 수에 따라 병렬), 2단계 항목 10개당 1회, 묶음 정리 1회 정도입니다. 그 밖의 서비스(Vercel Hobby, Redis Cloud Free, Groq·Gemini 무료 등급)는 무료 범위에서 씁니다.
- 사진은 서버에 남지 않습니다. `DEBUG_STORE=1` 로 켜면 최근 스캔 20건(사진 포함)이 Redis 에 7일 보관되므로, 혼자 테스트할 때만 켜고 다른 사람에게 코드를 나눠 주기 전에 끄세요.
- 초대 코드별 호출 한도는 아직 없습니다(`docs/wiki/backlog.md`). 코드를 아는 사람은 내 키로 호출할 수 있다는 뜻이니 가까운 사람에게만 나눠 주세요.

## 저장소 구성과 문서

```
api/            Vercel 서버 함수 (analyze, chat, icon, talk, stt, auth, rate, photo)와 _lib/ (llm 제공자, ocr, 프롬프트, 발음 규칙, 캐시)
src/            Vite + React 앱 (screens, components, lib, i18n ko·ja, 도트 아이콘 CSS)
scripts/        아이콘 생성(px_icons.py), 벤치·규칙 테스트(bench/)
docs/wiki/      작업하며 쌓은 구조·결정·측정·로그 (아래 참고)
```

- `docs/wiki/index.md` 가 문서의 시작점입니다. 구조와 파일 지도(`architecture`), 화면 결정(`design-decisions` 와 하위 세 장), 배포와 환경변수(`deploy-and-env`), 측정(`benchmarks`), 남은 과제(`backlog`), 월별 작업 로그(`log/`).
- `AGENTS.md` 와 `CLAUDE.md` 는 사람이 아니라 **코딩 에이전트(Claude Code)와 일할 때 쓴 작업 규약**입니다. 작업 유형별로 어느 문서를 읽을지 정하는 판정표, 검증 절차, 기록 의무, PR 과 배포 절차가 들어 있습니다. 거의 모든 코드와 문서를 이 규약 아래에서 에이전트와 함께 썼습니다. 일부 절차(`git-claw:*` 스킬)는 작성자의 개인 플러그인을 가리키므로 그대로는 못 쓰고, 방식을 참고하는 용도입니다.
- 발음·언어 판정·주문 문구 규칙은 테스트로 고정돼 있습니다: `node --experimental-strip-types --import ./scripts/bench/register-ts.mjs --test scripts/bench/rules_test.ts scripts/bench/talk_test.ts scripts/bench/order_test.ts`

## 한계

- 일본어↔한국어 두 방향만 지원합니다. 다른 언어 쌍은 프롬프트의 방향 함수(`api/_lib/direction.ts`, `prompt.ts`)와 발음 규칙을 새로 써야 합니다.
- iPhone Safari 홈 화면 앱 기준으로 만들었습니다. Android Chrome 도 동작하지만 실기기 확인은 적습니다.
- 손글씨, 저조도, 심한 원근 왜곡은 OCR 이 놓칠 수 있고 그때는 이미지 폴백으로 갑니다(글자만 받는 모델이면 분석 불가).
- 품질은 개인 여행에서 쓸 만한 수준을 기준으로 맞췄고, 모델 간 품질 비교는 하지 않았습니다.

## 라이선스

MIT. `LICENSE` 참고.

---

## English summary

MenuLens is a personal mobile web app that reads restaurant menus and signs from a photo. Korean travelers get Japanese photos in Korean, Japanese travelers get Korean photos in Japanese (app language toggle on the home screen, source language auto-detected). Menus get an overlay with numbered badges, translations, dish descriptions, converted prices, pixel-art icons, an order sheet with pronunciation, and a chat about the photo. Signs get paragraph-level translation covers and a summary. A conversation interpreter (speech or text) with rule-based pronunciation is included.

**Pipeline**: photo → Upstage Document OCR (words with coordinates) → LLM stage 1 structures the word list into items (streamed) → LLM stage 2 adds descriptions in parallel (cached in Redis). The LLM only sees the image when OCR finds almost no text, or when the chat needs the photo.

**You need**: an LLM key (Anthropic recommended; OpenAI, Upstage Solar and Timely Router are supported via `LLM_PROVIDER`), an Upstage API key for OCR, optionally Groq/Gemini keys for speech recognition, a Vercel account (Hobby) and optionally a free Redis. Copy `.env.example` to `.env`, `pnpm install`, `pnpm dev`. To deploy: fork, import into Vercel, set `ANTHROPIC_API_KEY`, `UPSTAGE_API_KEY` and `ACCESS_CODES` (an invite code that keeps strangers from spending your keys), deploy, add to your phone's home screen.

`AGENTS.md` and `docs/wiki/` are the working conventions and the decision/measurement log used while building this with a coding agent; they are published as reference, not as a template that works out of the box. MIT licensed.
