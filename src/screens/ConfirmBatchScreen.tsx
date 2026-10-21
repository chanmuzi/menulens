/** 사진 모음 확인. 촬영·앨범으로 들어온 사진을 썸네일로 보여주고 더 찍기·앨범 추가·빼기·순서 바꾸기·사진별 자르기 뒤 「N장 분석하기」.
 *  카메라 입력은 한 번에 한 장만 돌려주므로 여러 장은 「더 찍기」로 OS 카메라를 다시 여는 왕복이다. 자르기는 타일을 누르면 그 사진만 영역 지정 화면으로 */
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
  /** i 번째 사진의 영역을 지정해 잘라 넣기 */
  readonly onCrop: (index: number) => void;
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

const tile = { position: 'relative' as const, aspectRatio: '1', background: 'var(--wood)', overflow: 'hidden' };
const addTile = { ...tile, background: 'var(--paper-2)', border: '2px dashed var(--ink)', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: 'var(--ink)', padding: 0 };
const barBtn = (enabled: boolean) => ({ border: 0, background: 'transparent', padding: '0 10px', minHeight: 32, fontSize: 12, cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.3, color: 'var(--ink)' });

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
  const many = files.length > 1;
  const add = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).slice(0, Math.max(0, room));
    e.target.value = '';
    if (picked.length > 0) onChange([...files, ...picked]);
  };

  return (
    <div className="app">
      <TopBar onBack={onCancel} backLabel="그만두기" center={
        <div style={{ textAlign: 'center' }}>
          <div className="dot" style={{ fontSize: 16 }}>{files.length}장 모았어요</div>
          <div className="muted" style={{ fontSize: 11 }}>사진을 누르면 영역을 잘라요</div>
        </div>
      } />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {files.map((f, i) => (
          <div key={fileKey(f)} className="frame" style={tile}>
            <button type="button" aria-label={`사진 ${i + 1} 영역 자르기`} onClick={() => onCrop(i)} style={{ display: 'block', width: '100%', height: '100%', padding: 0, border: 0, background: 'transparent', cursor: 'pointer' }}>
              {urls[i] && <img src={urls[i]} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </button>
            <span className="dot" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, padding: '1px 6px', background: 'var(--ink)', color: 'var(--paper)', fontSize: 11, pointerEvents: 'none' }}>{i + 1}</span>
            {many && (
              <button type="button" aria-label={`사진 ${i + 1} 빼기`} onClick={() => onChange(files.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 0, right: 0, width: 32, height: 32, padding: 0, background: 'var(--paper-2)', border: 0, borderLeft: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)', cursor: 'pointer', fontSize: 13 }}>✕</button>
            )}
            {reading === f && <span className="dot" style={{ position: 'absolute', left: 0, right: 0, bottom: 34, textAlign: 'center', fontSize: 10, background: 'rgba(251,245,232,.9)', padding: '1px 0', pointerEvents: 'none' }}>읽는 중<span className="blink">▌</span></span>}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--paper-2)', borderTop: '2px solid var(--ink)' }}>
              <button type="button" aria-label={`사진 ${i + 1} 앞으로`} disabled={i === 0} onClick={() => onChange(swap(files, i, i - 1))} className="dot" style={barBtn(i > 0)}>◀</button>
              <button type="button" aria-label={`사진 ${i + 1} 자르기`} onClick={() => onCrop(i)} style={{ ...barBtn(true), padding: '0 4px', fontWeight: 500 }}>자르기</button>
              <button type="button" aria-label={`사진 ${i + 1} 뒤로`} disabled={i === files.length - 1} onClick={() => onChange(swap(files, i, i + 1))} className="dot" style={barBtn(i < files.length - 1)}>▶</button>
            </div>
          </div>
        ))}
        {room > 0 && (
          <>
            <button type="button" onClick={() => cameraRef.current?.click()} style={addTile}>
              <span className="dot" style={{ fontSize: 26, color: 'var(--vermilion)', lineHeight: 1 }}>+</span>더 찍기
            </button>
            <button type="button" onClick={() => albumRef.current?.click()} style={addTile}>
              <span className="dot" style={{ fontSize: 26, color: 'var(--vermilion)', lineHeight: 1 }}>▣</span>앨범에서 추가
            </button>
          </>
        )}
      </div>
      {(room <= 0 || dropped > 0) && (
        <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>
          {room <= 0 && <>한 번에 {BATCH_MAX}장까지예요.</>}{dropped > 0 && <> 뒤의 {dropped}장은 뺐어요.</>}
        </p>
      )}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={add} className="sr-only" tabIndex={-1} aria-hidden="true" aria-label="카메라로 더 찍기" />
      <input ref={albumRef} type="file" accept="image/*" multiple onChange={add} className="sr-only" tabIndex={-1} aria-hidden="true" aria-label="앨범에서 추가" />
      <div style={{ marginTop: 'auto' }}>
        <button type="button" className="btn btn--primary" onClick={() => onConfirm(files)} disabled={files.length === 0} style={{ width: '100%', fontWeight: 600 }}>{files.length}장 분석하기</button>
      </div>
    </div>
  );
};
