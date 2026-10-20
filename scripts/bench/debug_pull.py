#!/usr/bin/env python3
"""Redis 에 보관된 진단 스캔을 내려받는다 (DEBUG_STORE=1 로 배포했을 때). 표준 라이브러리만 사용.

사용법: REDIS_URL=redis://default:pw@host:port python3 scripts/bench/debug_pull.py <출력 폴더>
각 스캔마다 <id>.json (단어·항목·문구) 과 <id>.jpg (사진) 을 저장한다.
"""
import base64, json, os, socket, ssl, sys, urllib.parse

u = urllib.parse.urlparse(os.environ["REDIS_URL"])
out = sys.argv[1] if len(sys.argv) > 1 else "debug_scans"
os.makedirs(out, exist_ok=True)

sock = socket.create_connection((u.hostname, u.port), timeout=15)
if u.scheme == "rediss": sock = ssl.create_default_context().wrap_socket(sock, server_hostname=u.hostname)
buf = b""

def read_line():
    global buf
    while b"\r\n" not in buf: buf += sock.recv(65536)
    line, buf = buf.split(b"\r\n", 1); return line

def read_reply():
    global buf
    line = read_line(); t, body = line[:1], line[1:]
    if t in (b"+", b":"): return body.decode()
    if t == b"-": raise RuntimeError(body.decode())
    if t == b"$":
        n = int(body)
        if n < 0: return None
        while len(buf) < n + 2: buf += sock.recv(65536)
        data, buf = buf[:n], buf[n + 2:]; return data.decode()
    if t == b"*": return [read_reply() for _ in range(int(body))]
    raise RuntimeError(f"unknown reply {line!r}")

def cmd(*args):
    msg = f"*{len(args)}\r\n".encode()
    for a in args: b = str(a).encode(); msg += f"${len(b)}\r\n".encode() + b + b"\r\n"
    sock.sendall(msg); return read_reply()

cmd("AUTH", u.username or "default", u.password)
ids = cmd("LRANGE", "menulens:debug:list", 0, -1)
print(f"{len(ids)} scans")
for i in ids:
    raw = cmd("GET", f"menulens:debug:{i}")
    if not raw: continue
    rec = json.loads(raw); img = rec.pop("image", None)
    json.dump(rec, open(f"{out}/{i}.json", "w"), ensure_ascii=False, indent=1)
    if img: open(f"{out}/{i}.jpg", "wb").write(base64.b64decode(img))
    print(f"  {i} {rec['at']} mode={rec['mode']} words={len(rec['words'])} items={len(rec['items'])} image={'yes' if img else 'no'}")
sock.close()
