# 안내문(sign) 테스트 이미지: 조명 그라데이션 + 종이 얼룩이 있는 게시판에 일본어 안내 5줄 + 영어 1줄.
# 덮개 라벨의 배경 조각(획만 지우기)이 단색 상자와 어떻게 다른지 보기 위한 것. 사용: python3 make_sign.py out.jpg
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random
import sys
font = ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', 40)
mid = ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', 30)
W, H = 900, 1000
paper = Image.new('RGB', (W, H))
px = paper.load()
# 왼쪽 위가 밝고 오른쪽 아래가 어두운 조명 그라데이션
for yy in range(H):
    for xx in range(W):
        t = (xx / W) * 0.5 + (yy / H) * 0.5
        px[xx, yy] = (int(250 - 60 * t), int(243 - 62 * t), int(226 - 70 * t))
# 종이 얼룩
random.seed(7)
d = ImageDraw.Draw(paper)
for _ in range(40):
    cx, cy, r = random.randint(0, W), random.randint(0, H), random.randint(20, 90)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(random.randint(200, 230), random.randint(190, 215), random.randint(160, 190)))
paper = paper.filter(ImageFilter.GaussianBlur(14))
d = ImageDraw.Draw(paper)
d.rectangle([30, 30, W - 30, H - 30], outline=(90, 60, 40), width=6)
lines = [
    ("営業時間 11:00〜22:00", font, (42, 33, 27)),
    ("定休日 毎週水曜日", font, (42, 33, 27)),
    ("店内は全席禁煙です", mid, (200, 64, 47)),
    ("お手洗いは二階にございます", mid, (42, 33, 27)),
    ("お一人様一点限り", mid, (42, 33, 27)),
    ("Thank you for coming!", mid, (90, 80, 70)),
]
y = 110
for text, f, color in lines:
    d.text((80, y), text, font=f, fill=color)
    y += 130
paper.save(sys.argv[1], quality=88)
print("ok", paper.size)
