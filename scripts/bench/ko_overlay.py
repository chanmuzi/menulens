#!/usr/bin/env python3
"""ko_bench.py 가 남긴 JSON 의 OCR 단어 상자를 사진 위에 그려 OCR 품질을 눈으로 확인한다(보고용 캡처).
실행: python3 scripts/bench/ko_overlay.py <사진.jpg> <벤치 JSON> <출력.jpg>
한글 단어는 파랑, 숫자·가격은 주홍, 그 밖은 회색. rotation 이 있으면 화면과 같이 되돌려 그린다.
"""
import json, re, sys
from PIL import Image, ImageDraw, ImageFont

img = Image.open(sys.argv[1]).convert('RGB')
rec = json.load(open(sys.argv[2]))
rot = (rec.get('ocr') or {}).get('rotation') or 0
W, H = img.size
d = ImageDraw.Draw(img, 'RGBA')
font = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', max(12, W // 70))
for w in rec.get('words', []):
    x0, y0, x1, y1 = w['box']
    box = [x0 * W / 1000, y0 * H / 1000, x1 * W / 1000, y1 * H / 1000]
    t = w['t']
    color = (40, 90, 200) if re.search(r'[가-힣]', t) else (200, 70, 40) if re.search(r'\d', t) else (120, 120, 120)
    d.rectangle(box, outline=color + (230,), width=2)
    d.rectangle([box[0], box[1] - font.size - 2, box[0] + font.getlength(t) + 6, box[1]], fill=color + (210,))
    d.text((box[0] + 3, box[1] - font.size - 1), t, font=font, fill=(255, 255, 255))
if rot: img = img.rotate(rot, expand=True)  # 화면과 같이 글자가 바로 서게
img.thumbnail((1000, 1400))
img.save(sys.argv[3], quality=80)
print('ok', img.size, 'words', len(rec.get('words', [])), 'rotation', rot)
