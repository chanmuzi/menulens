/** 사진 모음 확인. 촬영·앨범으로 들어온 사진을 썸네일로 보여주고 더 찍기·앨범 추가·빼기·순서 바꾸기 뒤 「N장 분석하기」.
 *  카메라 입력은 한 번에 한 장만 돌려주므로 여러 장은 「더 찍기」로 OS 카메라를 다시 여는 왕복이다. 영역 지정은 한 장일 때만(ConfirmScreen) */
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { TopBar } from '../components/TopBar';
import { BATCH_MAX } from '../lib/batch';

type Props = {
  readonly files: readonly File[];
  readonly onChange: (files: readonly File[]) => void;
  /** 상한 때문에 뺀 장수 */
  readonly dropped: number;
  /** 첫 장을 뒤에서 미리 읽는 중이면 그 파일 */
  readonly reading: File | null;
  readonly onConfirm: (files: readonly File[]) => void;
  /** 한 장일 때 영역을 지정해 읽기 */
  readonly onCrop: () => void;
  readonly onCancel: () => void;
};

/** File 객체마다 고유 키. 같은 사진을 두 번 넣어도 React 키가 겹치지 않게 */
const fileIds = new WeakMap<File, string>();
let fileSeq = 0;
const fileKey = (f: File): string => { const k = fileIds.get(f) ?? `f${++fileSeq}`; fileIds.set(f, k); return k; };

const swap = (list: readonly File[], i: number, j: number): readonly File[] => {
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
};

export const ConfirmBatchScreen = ({ files, dropped, onChange, reading, onConfirm, onCrop, onCancel }: Props) => {
  const [urls, setUrls] = useState<readonly string[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const list = files.map((f) => URL.createObjectURL(f));
    setUrls(list);
    return () => { list.forEach((u) => URL.revokeObjectURL(u)); };
  }, [files]);
  const room = BATCH_MAX - files.length;
  const add = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).slice(0, Math.max(0, room));
    e.target.value = '';
    if (picked.length > 0) onChange([...files, ...picked]);
  };
  const tile = { position: 'relative' as const, aspectRatio: '1', background: 'var(--wood)', overflow: 'hidden' };
  const corner = { position: 'absolute' as const, top: 0, width: 32, height: 32, padding: 0, background: 'var(--paper-2)', border: 0, borderBottom: '2px solid var(--ink)', cursor: 'pointer', fontSize: 13 };

  return (
    <div className="app">
      <TopBar onBack={onCancel} backLabel="그만두기" center={
        <div style={{ textAlign: 'center' }}>
          <div className="dot" style={{ fontSize: 16 }}>{files.length}장 모았어요</div>
          <div className="muted" style={{ fontSize: 11 }}>더 찍거나 순서를 바꾸세요</div>
        </div>
      } />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {files.map((f, i) => (
          <div key={fileKey(f)} className="frame" style={tile}>
            {urls[i] && <img src={urls[i]} alt={`사진 ${i + 1}`} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <span className="dot" style={{ position: 'absolute', left: 0, top: 0, padding: '1px 6px', background: 'var(--ink)', color: 'var(--paper)', fontSize: 11 }}>{i + 1}</span>
            {files.length > 1 && (
              <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => onChange(files.filter((_, j) => j !== i))} style={{ ...corner, right: 0, borderLeft: '2px solid var(--ink)' }}>✕</button>
            )}
            {reading === f && <span className="dot" style={{ position: 'absolute', left: 0, right: 0, bottom: files.length > 1 ? 34 : 0, textAlign: 'center', fontSize: 10, background: 'rgba(251,245,232,.9)', padding: '1px 0' }}>읽는 중<span className="blink">▌</span></span>}
            {files.length > 1 && (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'space-between', background: 'var(--paper-2)', borderTop: '2px solid var(--ink)' }}>
                <button type="button" aria-label={`사진 ${i + 1} 앞으로`} disabled={i === 0} onClick={() => onChange(swap(files, i, i - 1))} className="dot" style={{ border: 0, background: 'transparent', padding: '0 14px', minHeight: 32, fontSize: 12, cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1 }}>◀</button>
                <button type="button" aria-label={`사진 ${i + 1} 뒤로`} disabled={i === files.length - 1} onClick={() => onChange(swap(files, i, i + 1))} className="dot" style={{ border: 0, background: 'transparent', padding: '0 14px', minHeight: 32, fontSize: 12, cursor: i === files.length - 1 ? 'default' : 'pointer', opacity: i === files.length - 1 ? 0.3 : 1 }}>▶</button>
              </div>
            )}
          </div>
        ))}
        {room > 0 && (
          <button type="button" onClick={() => cameraRef.current?.click()} style={{ ...tile, background: 'var(--paper-2)', border: '2px dashed var(--ink)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, fontSize: 13, color: 'var(--ink)' }}>
            <span className="dot" style={{ fontSize: 26, color: 'var(--vermilion)', lineHeight: 1 }}>+</span>더 찍기
          </button>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, flex: 1 }}>
          메뉴판이 여러 면이면 읽는 순서대로. 사진마다 따로 읽어서 끝나는 대로 보여드려요.{room <= 0 && <> 한 번에 {BATCH_MAX}장까지예요.</>}{dropped > 0 && <> 뒤의 {dropped}장은 뺐어요.</>}
        </p>
        {room > 0 && <button type="button" className="btn btn--quiet" onClick={() => albumRef.current?.click()} style={{ minHeight: 32, padding: '0 8px', fontSize: 12, flexShrink: 0 }}>앨범에서 추가</button>}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={add} className="sr-only" tabIndex={-1} aria-hidden="true" aria-label="카메라로 더 찍기" />
      <input ref={albumRef} type="file" accept="image/*" multiple onChange={add} className="sr-only" tabIndex={-1} aria-hidden="true" aria-label="앨범에서 추가" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
        <button type="button" className="btn btn--primary" onClick={() => onConfirm(files)} disabled={files.length === 0} style={{ fontWeight: 600 }}>{files.length}장 분석하기</button>
        {files.length === 1 && <button type="button" className="btn btn--quiet" onClick={onCrop}>영역을 지정해서 읽기</button>}
      </div>
    </div>
  );
};
