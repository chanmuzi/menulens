/** 대표 사진 조회. 같은 검색어의 동시 요청은 하나의 Promise 를 공유하고, 결과는 localStorage 에 캐시한다. */
import type { MenuItem, Photo } from '../types';
import { fetchPhoto } from './api';
import { loadPhoto, savePhoto } from './storage';

const inflight = new Map<string, Promise<Photo>>();

export const getPhoto = (query: string): Promise<Photo> => {
  const cached = loadPhoto(query);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(query);
  if (existing) return existing;
  const p = fetchPhoto(query)
    .catch((): Photo => ({ url: null }))
    .then((photo) => { savePhoto(query, photo); inflight.delete(query); return photo; });
  inflight.set(query, p);
  return p;
};

/** 스캔이 끝난 뒤 백그라운드로 사진을 미리 받아 둔다 (사진 토글 시 바로 뜨도록). 브라우저 동시 연결 수를 고려해 4개씩. */
export const prefetchPhotos = async (items: readonly MenuItem[]): Promise<void> => {
  const queries = [...new Set(items.map((i) => i.photo_query))];
  for (let i = 0; i < queries.length; i += 4) {
    await Promise.all(queries.slice(i, i + 4).map((q) => getPhoto(q).then(() => undefined)));
  }
};
