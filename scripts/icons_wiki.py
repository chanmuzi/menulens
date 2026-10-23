#!/usr/bin/env python3
"""보유 도트 아이콘 목록 → docs/wiki/icons.md. 사용법: python3 scripts/icons_wiki.py > docs/wiki/icons.md"""
import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from px_icons import SPRITES, PALETTE  # noqa: E402

ts = open(os.path.join(os.path.dirname(__file__), '..', 'src', 'lib', 'icons.ts'), encoding='utf-8').read()
def rules_of(block: str):
    """`const NAME: ... = [ ... ];` 블록 안의 [/정규식/, '아이콘'] 쌍만 뽑는다"""
    m = re.search(r"const " + block + r"\b.*?= \[(.*?)\n\];", ts, re.S)
    out = {}
    for pat, icon in re.findall(r"\[/(.+?)/, '([a-z]+)'\]", m.group(1)):
        out.setdefault(icon, []).append(pat.replace('|', ' · '))
    return out

UI_ONLY = {'bubble'}  # 메뉴 매칭에 쓰지 않는 화면용 아이콘
drink = rules_of('DRINK_RULES')
food = rules_of('FOOD_RULES')
drink_icons = re.search(r"const DRINK_ICONS = new Set\(\[(.*?)\]\)", ts, re.S).group(1)
drink_set = set(re.findall(r"'([a-z]+)'", drink_icons))
generic = set(re.findall(r"'([a-z]+)'", re.search(r"const GENERIC = new Set\(\[(.*?)\]\)", ts, re.S).group(1)))

print('# 도트 아이콘 목록 (자동 생성: `python3 scripts/icons_wiki.py > docs/wiki/icons.md`)\n')
print(f'보유 {len(SPRITES)}종(화면 전용 {len(UI_ONLY)}종 포함: ' + ', '.join(sorted(UI_ONLY)) + '). 격자는 `scripts/px_icons.py`, 규칙은 `src/lib/icons.ts`, 제작 규칙은 `.claude/skills/pixel-icon/SKILL.md`. 화면 UI 글리프(기록 줄의 연필·휴지통 10×10)는 이 목록 밖, `src/components/DotGlyph.tsx`.\n')
print('## 음료 규칙 (`DRINK_RULES`, 앞 규칙 우선)\n')
print('음료 칸이거나 모델이 음료 아이콘(`DRINK_ICONS`)을 골랐을 때만 본다. 음식 규칙은 보지 않는다.\n')
print('| 이름 | 키워드 |\n|---|---|')
for name in SPRITES:
    if name in drink_set or name in drink:
        print(f"| `{name}` | {' / '.join(drink.get(name, [])) or '(모델 선택·별칭 전용)'} |")
print('\n## 음식 규칙 (`FOOD_RULES`, 앞 규칙 우선)\n')
print('| 이름 | 키워드 |\n|---|---|')
for name in SPRITES:
    if name not in drink_set and name not in UI_ONLY:
        print(f"| `{name}` | {' / '.join(food.get(name, [])) or '(모델 선택·별칭·자리표시 전용)'} |")
print('\n## 매칭 순서\n')
print('0. 음료 판정: 카테고리가 음료이거나 모델이 `DRINK_ICONS`(' + ', '.join(sorted(drink_set)) + ') 중 하나를 골랐으면 `DRINK_RULES` 만, 아니면 `FOOD_RULES` 만 본다.')
print('1. 원문 키워드 규칙(앞 규칙 우선). 뭉뚱그린 규칙(' + '·'.join(sorted(generic)) + ')에 걸렸는데 모델이 더 구체적인 것을 골랐으면 모델을 따른다.')
print('2. 모델 선택(별칭 `ALIASES` 포함)이 목록에 있으면 사용. 뭉뚱그린 값이면 음료는 `cup`, 디저트·기타는 그대로, 그 외는 `camera` 자리표시.')
print('3. 카테고리 기본값(음료 cup, 디저트 cake, 기타 dish, 그 외 `camera`).')
print('4. `camera` 자리표시는 `/api/icon` 이 상위 모델로 생성(Redis 1년 · 기기 localStorage 캐시)해 교체한다.')
print('\n## 팔레트\n')
print(', '.join(f'`{k}` {v}' for k, v in PALETTE.items()))
