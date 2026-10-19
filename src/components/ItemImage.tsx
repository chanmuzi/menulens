import { useEffect, useState } from 'react';
import type { ImageMode, MenuItem, Photo } from '../types';
import { getPhoto } from '../lib/photos';
import { loadPhoto } from '../lib/storage';
import { PixelIcon } from './PixelIcon';

type Props = { readonly item: MenuItem; readonly mode: ImageMode; readonly size: number };

const usePhoto = (query: string, enabled: boolean): Photo | null => {
  const [photo, setPhoto] = useState<Photo | null>(() => loadPhoto(query));
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    getPhoto(query).then((p) => { if (!cancelled) setPhoto(p); });
    return () => { cancelled = true; };
  }, [query, enabled]);
  return photo;
};

/** 그림(픽셀 아이콘) / 사진 토글에 따라 대표 이미지를 보여준다. 사진이 없거나 로딩 중이면 그림으로 대체. */
export const ItemImage = ({ item, mode, size }: Props) => {
  const photo = usePhoto(item.photo_query, mode === 'photo');
  const box = { width: size, height: size, background: 'var(--paper-dark)', border: '2px solid var(--ink)', flexShrink: 0, position: 'relative' as const, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const px = Math.max(2, Math.floor((size - 16) / 16));

  if (mode === 'photo' && photo?.url) {
    return (
      <div style={box}>
        <img src={photo.url} alt={item.name_ko} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    );
  }
  const caption = mode === 'photo' ? (photo === null ? '사진 찾는 중' : '사진 없음') : null;
  return (
    <div style={box}>
      <PixelIcon icon={item.icon} size={px} label={item.name_ko} />
      {caption && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--ink)', color: 'var(--paper)', fontSize: 9, textAlign: 'center', padding: '2px 0' }}>{caption}</div>}
    </div>
  );
};
