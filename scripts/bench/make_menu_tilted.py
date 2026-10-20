# 기울어진 가로쓰기 메뉴판(14개 항목) 테스트 이미지: 나무 탁자 위 종이가 -7도 회전
from PIL import Image, ImageDraw, ImageFont
import sys
font = ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', 30)
small = ImageFont.truetype('/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc', 24)
items = [("豚バラ串",170),("豚ロース串",170),("鶏もも串",170),("牛串",250),("うずら卵串",160),("チーズ串",180),("えび串",230),("いか串",200),("なす串",150),("しいたけ串",160),("じゃがいも串",140),("ししとう串",150),("紅しょうが串",130),("アスパラ串",180)]
paper = Image.new('RGB', (620, 820), (245, 238, 222))
d = ImageDraw.Draw(paper)
d.rectangle([20, 20, 600, 800], outline=(42, 33, 27), width=4)
d.text((40, 36), "串カツ メニュー", font=font, fill=(200, 64, 47))
y = 100
for name, price in items:
    d.text((50, y), name, font=font, fill=(42, 33, 27))
    d.text((430, y + 4), f"{price}円", font=small, fill=(42, 33, 27))
    y += 48
rot = paper.rotate(7, expand=True, resample=Image.BICUBIC, fillcolor=(0, 0, 0))
mask = Image.new('L', paper.size, 255).rotate(7, expand=True)
bg = Image.new('RGB', (900, 1100), (120, 84, 52))
bd = ImageDraw.Draw(bg)
for x in range(0, 900, 18): bd.line([(x, 0), (x, 1100)], fill=(108, 74, 45), width=4)
bg.paste(rot, (110, 100), mask)
bg.save(sys.argv[1], quality=88)
print("ok", bg.size)
