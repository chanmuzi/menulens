/** 서버 NDJSON 스트림(한 줄에 이벤트 하나)을 줄 단위로 넘긴다. 빈 줄은 건너뛴다. handle 이 던지면 읽기를 멈추고 그대로 던진다 */
export const readNdjson = async <E,>(body: ReadableStream<Uint8Array>, handle: (ev: E) => void): Promise<void> => {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let pending = '';
  const line = (raw: string) => { if (raw.trim()) handle(JSON.parse(raw) as E); };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pending += dec.decode(value, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop() ?? '';
    lines.forEach(line);
  }
  // 디코더에 남은 바이트까지 비운다(멀티바이트 글자가 마지막 조각에 걸린 경우)
  pending += dec.decode();
  line(pending);
};
