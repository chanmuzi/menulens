# 테스트용 가상 短冊 메뉴판 이미지 생성 (macOS 내장 일본어 폰트 사용)
from PIL import Image, ImageDraw, ImageFont
import sys
W,H=900,700
img=Image.new('RGB',(W,H),(59,42,30))
d=ImageDraw.Draw(img)
for x in range(0,W,14): d.line([(x,0),(x,H)],fill=(52,36,25),width=3)
font=None
for p in ['/System/Library/Fonts/ヒラギノ明朝 ProN.ttc','/System/Library/Fonts/Hiragino Sans GB.ttc','/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc','/Library/Fonts/Arial Unicode.ttf']:
    try: font=ImageFont.truetype(p,34); break
    except Exception: pass
if font is None: sys.exit("no jp font")
items=[("唐揚げ","五八〇"),("餃子","四五〇"),("刺身盛合せ","千二百"),("焼鳥盛合せ","七八〇"),("だし巻玉子","五二〇"),("生ビール","五五〇"),("枝豆","三八〇"),("ハイボール","四八〇")]
x=40
for name,price in items:
    d.rectangle([x,40,x+80,640],fill=(239,228,200))
    y=70
    for ch in name:
        d.text((x+22,y),ch,font=font,fill=(42,33,27)); y+=40
    y+=30
    for ch in price:
        d.text((x+22,y),ch,font=font,fill=(42,33,27)); y+=40
    x+=104
img.save(sys.argv[1],quality=88)
print("ok",font.path)
