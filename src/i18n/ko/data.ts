import type { Category, NoteRole, ScanKind, Tag } from '../../types';

/**
 * 모델 출력·저장 데이터의 고정 값(한국어 enum)을 화면에 보일 때의 이름.
 * 값 자체(Category '안주' 등)는 저장 형식이라 바꾸지 않고, 표시만 언어별로 한다.
 */
export const data = {
  category: { 안주: '안주', 식사: '식사', 음료: '음료', 디저트: '디저트', 기타: '기타' } as Readonly<Record<Category, string>>,
  /** 2단계 태그(모델이 내는 한국어 값) */
  tag: { 인기: '인기', 날것: '날것', 매움: '매움', 튀김: '튀김', 음료: '음료', 채식: '채식', '선택 필요': '선택 필요' } as Readonly<Record<Tag, string>>,
  kind: { menu: '메뉴판', sign: '안내문', other: '사진 속 글자' } as Readonly<Record<ScanKind, string>>,
  noteRole: { title: '제목', body: '본문', label: '이름표' } as Readonly<Record<NoteRole, string>>,
  today: '오늘',
  yesterday: '어제',
  weekday: ['일', '월', '화', '수', '목', '금', '토'] as readonly string[],
  am: '오전',
  pm: '오후',
  /** 금액 미표기 */
  noPrice: '가격 미표기',
};
