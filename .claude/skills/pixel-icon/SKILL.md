---
name: pixel-icon
description: MenuLens 도트 아이콘(16×16 box-shadow 스프라이트)을 추가·수정·점검할 때 쓴다. 팔레트·화풍 규칙·작업 절차·검증 방법.
---

# MenuLens 도트 아이콘 제작 규칙

아이콘은 `scripts/px_icons.py` 의 `SPRITES` 에 16×16 문자 격자로 둔다. 문자 하나 = 픽셀 하나, `.` = 투명.
`pnpm icons` 가 `src/styles/pixel-icons.css` 를 다시 만든다(직접 수정 금지). 같은 팔레트가 `api/_lib/pixel.ts`(서버 생성)와 `src/lib/pixel.ts`(런타임 렌더)에 복제되어 있다 — 팔레트를 바꾸면 셋 다 고친다.

## 팔레트

`k` 먹색(외곽선) · `o` 갈색 · `O` 밝은 황금(튀김·빵) · `y` 노랑 · `Y` 연노랑 · `p` 분홍(차슈·햄) · `P` 연분홍 · `g` 초록 · `G` 연초록 · `r` 주홍 · `w` 종이색 · `f` 흰색(밥·거품) · `s` 연어색 · `a` 호박색 · `b` 남색 · `B` 연남색 · `m` 적갈(고기) · `c` 베이지 · `d` 회갈 · `v` 보라

## 화풍 규칙 (지키지 않으면 다른 아이콘과 어긋난다)

1. 모든 덩어리는 `k` 로 1픽셀 외곽선. 안쪽은 2~3색. 하이라이트는 밝은 색 1~2픽셀.
2. 사물은 중앙에 크게(가로 10~14픽셀), 위아래 1~2줄 비움. 접시 위 음식이면 맨 아래 `k` 접시선 1줄(양끝 둥글게: `..kkwwwwwwwkk...` 꼴).
3. 정면 또는 살짝 위에서 본 시점. 원근·그림자 없음. 글자 없음.
4. 가장 알아보기 쉬운 특징 하나를 과장한다(새우: 굽은 몸·꼬리, 튀김: 울퉁불퉁 황금 표면, 맥주: 거품 층).
5. 좋은 예: `karaage`, `beer`, `shrimp`, `coffee`. 나쁜 예: 외곽선 없는 덩어리, 4색 이상, 1픽셀 선으로만 그린 것.

## 추가 절차

1. `SPRITES` 에 `'name': """…"""` 추가(16줄 × 16자 확인).
2. `src/lib/icons.ts` 의 `ICON_KEYS` 와 `KEYWORDS`/`ALIASES`, `api/_lib/prompt.ts` 의 `ICON_KEYS` 와 `ICON_RULE` 힌트에 같은 이름을 넣는다.
3. `pnpm icons && pnpm build`.
4. 검증: 세션 scratchpad 에 모든 `.px-*` 를 64px 로 그리는 HTML 을 만들어 헤드리스 Chrome 으로 캡처해 눈으로 본다(아래 스니펫). 캡처는 저장소에 넣지 않는다.
5. `docs/wiki/icons.md` 를 `python3 scripts/icons_wiki.py > docs/wiki/icons.md` 로 재생성한다.

```python
# scratchpad/icons.html 생성 예 (저장소 밖)
import re; css=open('src/styles/pixel-icons.css').read()
names=sorted(set(re.findall(r'^\.px-([a-z0-9-]+)', css, re.M)))
cells=''.join(f"<div class=c><div class=b><div class='px px-{n}'></div></div>{n}</div>" for n in names)
open('icons.html','w').write(f"<html><head><meta charset=utf-8><style>{css}body{{background:#F4EBD9;font-family:sans-serif;padding:16px}}.g{{display:grid;grid-template-columns:repeat(6,80px);gap:12px}}.c{{text-align:center;font-size:11px}}.b{{width:64px;height:64px;position:relative;margin:0 auto 4px}}.b .px{{position:absolute;left:0;top:0;font-size:4px}}</style></head><body><div class=g>{cells}</div></body></html>")
```

## 런타임 생성과의 관계

키워드·모델 매칭이 안 된 메뉴는 `camera`(로고) 자리표시로 그리고 `/api/icon` 이 상위 모델로 격자를 생성해 Redis(1년)·기기(localStorage)에 캐시한다(`src/lib/iconStore.ts`). 자주 나오는 메뉴가 생성 아이콘으로 반복 등장하면 이 절차로 **정식 스프라이트로 승격**한다(품질 손보기 → `SPRITES` 추가 → 키워드 등록).
