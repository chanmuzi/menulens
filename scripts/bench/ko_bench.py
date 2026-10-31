#!/usr/bin/env python3
"""한국어 사진(한→일 역방향) 벤치: 로컬 서버 /api/analyze 에 사진을 넣고 OCR 품질과 1단계 출력을 기록한다.
표준 라이브러리만 사용. 사진·출력은 세션 scratchpad 에 둔다.

실행: pnpm dev 를 띄운 뒤
      python3 scripts/bench/ko_bench.py <초대 코드> <출력 폴더> <사진.jpg> [<사진2.jpg> ...]
출력: <출력 폴더>/<사진 이름>.json — ocr(단어 수·한글/가나·한자 비율·rotation·tilt·ms), mode, kind, items, notes, meta, 시각
      표준 출력에 사진별 한 줄 요약.
"""
import base64, json, os, re, sys, time, urllib.request

code, out_dir, photos = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(out_dir, exist_ok=True)
PORT = int(os.environ.get('PORT', '5173'))

HANGUL = re.compile(r'[가-힣]')
KANA = re.compile(r'[぀-ヿ]')
HANJA = re.compile(r'[一-鿿]')

def script_ratio(words):
    text = ''.join(w['t'] for w in words)
    n = max(1, len(re.sub(r'\s', '', text)))
    return {'hangul': round(len(HANGUL.findall(text)) / n, 2), 'kana': round(len(KANA.findall(text)) / n, 2), 'hanja': round(len(HANJA.findall(text)) / n, 2), 'chars': n}

def run(path):
    body = json.dumps({'image': base64.b64encode(open(path, 'rb').read()).decode(), 'mediaType': 'image/jpeg'}).encode()
    req = urllib.request.Request(f'http://localhost:{PORT}/api/analyze', data=body, headers={'content-type': 'application/json', 'x-access-code': code})
    t0 = time.time()
    rec = {'photo': os.path.basename(path), 'items': [], 'notes': [], 'events': []}
    with urllib.request.urlopen(req, timeout=240) as r:
        for line in r:
            ev = json.loads(line)
            t = round(time.time() - t0, 2)
            rec['events'].append({'t': ev['t'], 'at': t})
            if ev['t'] == 'ocr':
                rec['ocr'] = {'words': len(ev.get('words', [])), 'rotation': ev.get('rotation'), 'tilt': ev.get('tilt'), 'ms': ev.get('ms'), 'used': ev.get('used'), 'error': ev.get('error'), **script_ratio(ev.get('words', []))}
                rec['words'] = ev.get('words', [])
            elif ev['t'] == 'mode': rec['mode'] = {'mode': ev.get('mode'), 'chunks': ev.get('chunks')}
            elif ev['t'] == 'kind': rec['kind_at'] = t
            elif ev['t'] == 'item': rec['items'].append(ev.get('item'))  # 항목 키: name/tr/price/price_tax/category/group/icon
            elif ev['t'] == 'note': rec['notes'].append(ev.get('note'))
            elif ev['t'] == 'meta': rec['meta'] = {k: v for k, v in ev.items() if k != 't'}; rec['list_at'] = t
            elif ev['t'] == 'details': rec.setdefault('details', []).extend(ev.get('items', []))
            elif ev['t'] == 'summary': rec['summary'] = ev.get('summary')
            elif ev['t'] == 'groups': rec['groups'] = ev.get('groups')
            elif ev['t'] == 'error': rec['error'] = ev.get('error')
            elif ev['t'] == 'done': rec['done_at'] = t; break
    return rec

for p in photos:
    rec = run(p)
    name = os.path.splitext(os.path.basename(p))[0]
    with open(os.path.join(out_dir, name + '.json'), 'w') as f: json.dump(rec, f, ensure_ascii=False, indent=1)
    o = rec.get('ocr', {})
    m = rec.get('meta', {})
    print(f"{name}: words={o.get('words')} hangul={o.get('hangul')} kana={o.get('kana')} rot={o.get('rotation')} tilt={o.get('tilt')} ocr={o.get('ms')}ms | mode={rec.get('mode',{}).get('mode')} kind={m.get('kind')} items={len(rec['items'])} notes={len(rec['notes'])} list={rec.get('list_at')}s done={rec.get('done_at')}s err={rec.get('error')}", flush=True)
