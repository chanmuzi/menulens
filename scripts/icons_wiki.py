#!/usr/bin/env python3
"""보유 도트 아이콘 목록 → docs/wiki/icons.md. 사용법: python3 scripts/icons_wiki.py > docs/wiki/icons.md"""
import re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from px_icons import SPRITES, PALETTE  # noqa: E402

ts = open(os.path.join(os.path.dirname(__file__), '..', 'src', 'lib', 'icons.ts'), encoding='utf-8').read()
rules = re.findall(r"\[/(.+?)/, '([a-z]+)'\]", ts)
by_icon = {}
for pat, icon in rules:
    by_icon.setdefault(icon, []).append(pat.replace('|', ' · '))

print('# 도트 아이콘 목록 (자동 생성: `python3 scripts/icons_wiki.py > docs/wiki/icons.md`)\n')
print(f'보유 {len(SPRITES)}종. 격자는 `scripts/px_icons.py`, 규칙은 `src/lib/icons.ts`, 제작 규칙은 `.claude/skills/pixel-icon/SKILL.md`.\n')
print('| 이름 | 키워드 규칙(앞 규칙 우선) |\n|---|---|')
for name in SPRITES:
    kw = ' / '.join(by_icon.get(name, [])) or '(모델 선택·별칭·자리표시 전용)'
    print(f'| `{name}` | {kw} |')
print('\n## 매칭 순서\n')
print('1. 원문 키워드 규칙(`KEYWORDS`, 앞 규칙 우선). 뭉뚱그린 규칙(drink·dessert·salad·soup·rice·dish·cake)에 걸렸는데 모델이 더 구체적인 재료를 골랐으면 모델을 따른다.')
print('2. 모델 선택(`icon`)이 목록에 있으면 사용. 뭉뚱그린 값이면 `camera` 자리표시.')
print('3. 별칭(`ALIASES`) → 카테고리 기본값(음료 drink, 디저트 cake, 기타 dish, 그 외 `camera`).')
print('4. `camera` 자리표시는 `/api/icon` 이 상위 모델로 생성(Redis 1년 · 기기 localStorage 캐시)해 교체한다.')
print('\n## 팔레트\n')
print(', '.join(f'`{k}` {v}' for k, v in PALETTE.items()))
