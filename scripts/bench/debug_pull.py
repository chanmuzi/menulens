#!/usr/bin/env python3
"""Upstash 에 보관된 진단 스캔을 내려받는다 (DEBUG_STORE=1 로 배포했을 때).

사용법: UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... python3 scripts/bench/debug_pull.py <출력 폴더>
각 스캔마다 <id>.json (단어·항목·문구) 과 <id>.jpg (사진) 을 저장한다.
"""
import base64, json, os, sys, urllib.request

url, token = os.environ["UPSTASH_REDIS_REST_URL"], os.environ["UPSTASH_REDIS_REST_TOKEN"]
out = sys.argv[1] if len(sys.argv) > 1 else "debug_scans"
os.makedirs(out, exist_ok=True)

def cmd(*args):
    req = urllib.request.Request(url, data=json.dumps(list(args)).encode(), headers={"authorization": f"Bearer {token}", "content-type": "application/json"})
    with urllib.request.urlopen(req) as r: return json.load(r)["result"]

ids = cmd("LRANGE", "menulens:debug:list", 0, -1)
print(f"{len(ids)} scans")
for i in ids:
    raw = cmd("GET", f"menulens:debug:{i}")
    if not raw: continue
    rec = json.loads(raw); img = rec.pop("image", None)
    json.dump(rec, open(f"{out}/{i}.json", "w"), ensure_ascii=False, indent=1)
    if img: open(f"{out}/{i}.jpg", "wb").write(base64.b64decode(img))
    print(f"  {i} {rec['at']} mode={rec['mode']} words={len(rec['words'])} items={len(rec['items'])} image={'yes' if img else 'no'}")
