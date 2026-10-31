# 한국어 메뉴판 테스트 이미지(역방향 한→일 검증용). 한국 식당에서 흔한 가격 표기를 한 장에 모은다:
#   「8,000」(원 단위 숫자만) · 「9.0」(천 원 단위 생략) · 「15,000원」 · 「(1인분)」 단위 · 「2인 이상」 조건 · 섹션 제목.
# 사용: python3 scripts/bench/make_menu_ko.py out.jpg   (출력은 세션 scratchpad 에)
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random
import sys

FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
title_f = ImageFont.truetype(FONT, 46, index=2)   # Bold
head_f = ImageFont.truetype(FONT, 34, index=2)
item_f = ImageFont.truetype(FONT, 30, index=1)    # Medium
small_f = ImageFont.truetype(FONT, 22, index=0)

W, H = 900, 1300
paper = Image.new('RGB', (W, H))
px = paper.load()
for yy in range(H):
    for xx in range(W):
        t = (xx / W) * 0.4 + (yy / H) * 0.6
        px[xx, yy] = (int(252 - 40 * t), int(246 - 44 * t), int(232 - 52 * t))
random.seed(3)
d = ImageDraw.Draw(paper)
for _ in range(30):
    cx, cy, r = random.randint(0, W), random.randint(0, H), random.randint(20, 80)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(random.randint(210, 235), random.randint(200, 222), random.randint(170, 195)))
paper = paper.filter(ImageFilter.GaussianBlur(12))
d = ImageDraw.Draw(paper)
d.rectangle([28, 28, W - 28, H - 28], outline=(70, 45, 35), width=5)

INK = (38, 30, 26)
RED = (190, 52, 40)
d.text((W // 2, 80), '할머니 손칼국수', font=title_f, fill=INK, anchor='mm')
d.text((W // 2, 125), '포장 가능 · 2인 이상 주문 시 공기밥 서비스', font=small_f, fill=(110, 90, 80), anchor='mm')

sections = [
    ('식사', [('손칼국수', '9,000'), ('바지락 칼국수', '11,000'), ('들깨 수제비', '10,000'), ('콩국수 (여름 한정)', '10,000'), ('김치찌개 (1인분)', '9.0'), ('제육볶음 (2인 이상)', '13.0')]),
    ('구이', [('삼겹살 (1인분 180g)', '15,000원'), ('목살 (1인분 180g)', '15,000원'), ('한우 등심 (150g)', '38,000원')]),
    ('분식', [('떡볶이', '6,000'), ('모둠 튀김', '5,000'), ('순대', '5,000'), ('김밥', '3,500')]),
    ('음료 · 주류', [('소주', '5,000'), ('맥주', '5,000'), ('막걸리', '4,000'), ('사이다 / 콜라', '2,000'), ('식혜', '3,000')]),
]
y = 185
for name, items in sections:
    d.text((70, y), name, font=head_f, fill=RED)
    d.line([(70, y + 48), (W - 70, y + 48)], fill=(120, 90, 80), width=2)
    y += 66
    for label, price in items:
        d.text((90, y), label, font=item_f, fill=INK)
        d.text((W - 90, y), price, font=item_f, fill=INK, anchor='ra')
        y += 46
    y += 20
d.text((W // 2, H - 70), '※ 모든 메뉴는 부가세 포함 가격입니다. 카드 결제 가능', font=small_f, fill=(110, 90, 80), anchor='mm')
paper.save(sys.argv[1], quality=88)
print('ok', paper.size)
