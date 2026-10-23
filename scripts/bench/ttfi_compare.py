"""두 로컬 서버(새 코드 5173 / 비교 기준 5174)에 같은 사진으로 /api/analyze 를 번갈아 호출해
첫 item 과 meta(목록 완성) 도착 시각(s)을 비교한다. 1단계 프롬프트·출력 형식을 바꿀 때 쓴다.
실행: 두 체크아웃에서 `pnpm dev --port 5173 --strictPort` / `--port 5174 --strictPort` 를 띄우고
      python3 scripts/bench/ttfi_compare.py <초대 코드> <사진.jpg>  (사진은 세션 scratchpad 에 둔다)
"""
import json, sys, time, urllib.request, base64
code, img = sys.argv[1], sys.argv[2]
body = json.dumps({'image': base64.b64encode(open(img, 'rb').read()).decode(), 'mediaType': 'image/jpeg'}).encode()
def run(port):
    t0 = time.time(); first = meta = None; title = None
    req = urllib.request.Request(f'http://localhost:{port}/api/analyze', data=body, headers={'content-type': 'application/json', 'x-access-code': code})
    with urllib.request.urlopen(req, timeout=180) as r:
        for line in r:
            ev = json.loads(line)
            t = round(time.time() - t0, 2)
            if ev['t'] == 'item' and first is None: first = t
            if ev['t'] == 'meta': meta = t; title = ev.get('title')
            if ev['t'] == 'done': break
    return first, meta, title
for i in range(3):
    for port, name in ((5173, 'new'), (5174, 'old')):
        print(name, run(port), flush=True)
