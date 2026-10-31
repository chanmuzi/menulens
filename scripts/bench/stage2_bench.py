"""OCR 결과(JSON)만 텍스트로 LLM에 넘겨 구조화·번역. 이미지 없음. 스트리밍 첫 바이트·총 시간 측정."""
import json, os, sys, time, urllib.request
ocr_path, model = sys.argv[1], sys.argv[2]
o = json.load(open(ocr_path))
pg = o['pages'][0]; W, H = pg['width'], pg['height']
words = []
for w in pg['words']:
    xs = [v['x'] for v in w['boundingBox']['vertices']]; ys = [v['y'] for v in w['boundingBox']['vertices']]
    words.append({'id': w['id'], 't': w['text'], 'box': [round(min(xs)/W*1000), round(min(ys)/H*1000), round(max(xs)/W*1000), round(max(ys)/H*1000)]})
ICONS = ["ramen","udon","gyoza","karaage","beer","highball","sake","sashimi","sushi","yakitori","meat","pork","chicken","shrimp","squid","fish","egg","tamago","tofu","edamame","eggplant","mushroom","potato","pepper","corn","salad","cheese","rice","curry","soup","dessert","drink","dish"]
SYSTEM = f"""당신은 일본어 OCR 결과를 한국인 여행객용으로 정리하는 도우미입니다. 입력은 사진에서 읽은 단어 목록(id, 텍스트, 0~1000 정규화 bbox)입니다. 세로쓰기(위→아래, 오른쪽→왼쪽)와 가로쓰기를 모두 고려해 단어를 메뉴 항목으로 묶으세요. 가격의 한자 숫자(五八〇/千二百)는 아라비아 숫자로. OCR 오류는 문맥으로 보정하세요.
JSON 만 출력: {{"kind":"menu|sign|other","items":[{{"name":"","tr":"","pron":"","price":정수|null,"desc":"30자 이내","tags":[],"category":"안주|식사|음료|디저트","icon":{json.dumps(ICONS)} 중 하나(주재료 기준),"word_ids":[이 항목을 이루는 단어 id 들]}}]}}"""
user = "단어 목록:\n" + json.dumps(words, ensure_ascii=False)
body = {"model": model, "max_tokens": 4000, "stream": True, "thinking": {"type": "adaptive"}, "output_config": {"effort": "low"}, "system": SYSTEM, "messages": [{"role": "user", "content": user}]}
req = urllib.request.Request("https://api.timelyrouter.ai/v1/messages", data=json.dumps(body).encode(), headers={"x-api-key": os.environ["TIMELY_API_KEY"], "anthropic-version": "2023-06-01", "content-type": "application/json"})
t0 = time.time(); first = None; text = ''; usage = None
with urllib.request.urlopen(req, timeout=180) as r:
    for line in r:
        line = line.decode('utf-8', 'ignore').strip()
        if not line.startswith('data:'): continue
        try: ev = json.loads(line[5:])
        except Exception: continue
        if ev.get('type') == 'content_block_delta' and ev['delta'].get('type') == 'text_delta':
            if first is None: first = time.time() - t0
            text += ev['delta']['text']
        if ev.get('type') == 'message_delta': usage = ev.get('usage')
total = time.time() - t0
try:
    d = json.loads(text); items = d.get('items', []); ok = True
except Exception: items = []; ok = False
print(f"{model:18s} in={len(user)}ch first={first:.1f}s total={total:.1f}s out_tokens={(usage or {}).get('output_tokens')} items={len(items)} json={'ok' if ok else 'BROKEN'}")
for it in items: print("   ", it.get('name'), '→', it.get('tr'), it.get('price'), it.get('icon'), it.get('word_ids'))
