import { CategoryKey, IconGrade, RatingTier } from '@/types';

/**
 * SVG 파일명에서 CategoryKey와 실제 파일명이 다른 경우 매핑
 * Other → Others, Idle → Blank
 */
const FILE_NAME_MAP: Partial<Record<CategoryKey, string>> = {
  Other: 'Others',
  Idle: 'Blank',
};

/**
 * 카테고리 한글 라벨 매핑
 */
export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  Korea: '한식',
  China: '중식',
  Japan: '일식',
  West: '양식',
  Asian: '아시안/동남아',
  Snack: '분식/간편식',
  Meat: '고기/구이',
  Sea: '해산물/횟집',
  Cafe: '카페/디저트',
  Beer: '술/바',
  Other: '기타',
  Idle: '미분류',
};

/** 모든 카테고리 키 목록 (필터 UI 등에서 사용) */
export const ALL_CATEGORY_KEYS: CategoryKey[] = [
  'Korea', 'China', 'Japan', 'West',
  'Asian', 'Snack', 'Meat', 'Sea',
  'Cafe', 'Beer', 'Other', 'Idle',
];

/**
 * RatingTier → IconGrade 변환 (null/undefined → 'N')
 */
export function tierToIconGrade(tier: RatingTier | null | undefined): IconGrade {
  return tier ?? 'N';
}

/**
 * 카테고리 + 등급 → SVG 아이콘 경로
 * @example getCategoryIconPath('Korea', 'S') → '/icons/categories/Korea_S.svg'
 * @example getCategoryIconPath('Other', 'N') → '/icons/categories/Others_N.svg'
 */
export function getCategoryIconPath(
  category: CategoryKey = 'Idle',
  grade: IconGrade = 'N',
): string {
  const fileName = FILE_NAME_MAP[category] || category;
  return `/icons/categories/${fileName}_${grade}.svg`;
}
