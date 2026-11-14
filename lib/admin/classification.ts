import { CategoryKey, Classification, ImportRow, OriginalCategory } from '@/types';
import { ALL_CATEGORY_KEYS, inferCategoryKey } from '@/lib/utils/categoryIcon';
import evidence from './categoryEvidence.json';
import { classifyFoodKeywords } from './categoryKeywords';

export const RULE_VERSION = 'local-corpus-keywords-v2';
export function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === 'string' && ALL_CATEGORY_KEYS.includes(value as CategoryKey);
}
export function normalizePath(value: unknown): string[] {
  if (typeof value === 'string') value = value.split(',');
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string' || !/^\d+$/.test(v))) return [];
  return value;
}
export function originalOf(row: { originalCategory?: OriginalCategory; category?: string; categoryCode?: string; cidPath?: unknown; mapProvider?: string; name?: string; address?: string }): OriginalCategory {
  return row.originalCategory || { provider: row.mapProvider === 'kakao' ? 'kakao' : 'naver', label: row.category || '', code: row.categoryCode || '', cidPath: normalizePath(row.cidPath) };
}
export function classify(row: Parameters<typeof originalOf>[0]): { categoryKey: CategoryKey; classification: Classification } {
  const raw = originalOf(row);
  const answer = (key: CategoryKey, reason: string) => ({ categoryKey: key, classification: {
    source: key === 'Idle' ? 'unresolved' as const : 'rule' as const,
    reason, needsReview: key === 'Idle', version: RULE_VERSION,
  } });
  if (raw.provider === 'naver' && raw.code === 'CAFE') return answer('Cafe', '네이버 원본 mcid=CAFE');
  if (raw.provider === 'naver' && raw.code === 'BAR') return answer('Beer', '네이버 원본 mcid=BAR');
  if (/^(관광명소|숙박|공원|박물관|미술관|주차장)$/.test(raw.label)) return answer('Other', `음식점 외 원본 분류: ${raw.label}`);
  const labelWord = classifyFoodKeywords(raw.label);
  if (labelWord) return answer(labelWord.key, `원본 분류 키워드 [${labelWord.rule}]: ${labelWord.keyword}`);
  const nameWord = classifyFoodKeywords(row.name || '');
  const nameAnswer = () => answer(nameWord!.key, `장소명 키워드 [${nameWord!.rule}]: ${nameWord!.keyword}; 원본=${raw.label}/${raw.code}`);
  // Native category paths outrank name guesses except broad Korean categories
  // and explicit dish/style refinements (e.g. 갈비탕, 경양식돈까스).
  for (let n = raw.provider === 'naver' ? raw.cidPath.length : 0; n >= 3; n--) {
    const path = raw.cidPath.slice(0, n).join('/');
    const match = (evidence as Record<string, { key: string | null; counts: Record<string, number>; files: string[]; share: number }>)[path];
    if (!match || !isCategoryKey(match.key)) continue;
    if (nameWord && (match.key === 'Korea' ||
      (match.key === 'Meat' && nameWord.rule === 'korean-prepared-food') ||
      (match.key === 'Japan' && nameWord.keyword === '경양식'))) return nameAnswer();
    return answer(match.key, `cidPath ${path}; initial_data ${match.files.join(', ')}; ${JSON.stringify(match.counts)}; 조정 지지율 ${match.share}; 세부 고기/해산물 우선`);
  }
  if (nameWord) return nameAnswer();
  const labelKey = inferCategoryKey(raw.label);
  if (labelKey !== 'Idle' && labelKey !== 'Other') return answer(labelKey, `원본 분류명: ${raw.label}`);
  const broadPath = raw.cidPath.slice(0, 2).join('/');
  const broad = (evidence as Record<string, { fallbackKey?: string | null; counts: Record<string, number> }>)[broadPath];
  if (raw.provider === 'naver' && isCategoryKey(broad?.fallbackKey)) return answer(broad.fallbackKey, `상위 cidPath ${broadPath}; 기존 폴더의 요리 계열 우세; ${JSON.stringify(broad.counts)}; 세부 경로/키워드 우선 적용 후 사용`);
  return answer('Idle', '상세 경로·원본 분류·장소명 키워드로 분류 불가; LLM 검토 필요');
}

// Legacy explicit choices have no provenance. Preserve them conservatively.
export function isProtectedCategory(row: { categoryKey?: string; classification?: Classification; category?: string; categoryCode?: string; originalCategory?: OriginalCategory }): boolean {
  return row.classification?.source === 'manual' || (!row.classification && isCategoryKey(row.categoryKey) &&
    (row.categoryKey !== 'Idle' && row.categoryKey !== 'Other' || row.categoryKey === 'Other' && !row.originalCategory?.code && !row.categoryCode && originalOf(row).label !== '음식점'));
}
export function needsCategoryReview(row: { categoryKey?: string; categoryCode?: string; category?: string; originalCategory?: OriginalCategory; classification?: Classification }): boolean {
  if (row.categoryKey === 'Idle') return true;
  if (isProtectedCategory(row)) return false;
  return !isCategoryKey(row.categoryKey) || row.categoryKey === 'Idle' || row.classification?.needsReview === true ||
    (row.categoryKey === 'Other' && !row.classification && (/^(DINING|CAFE|BAR)$/.test(originalOf(row).code) || originalOf(row).label === '음식점'));
}
export function prepareImport(row: ImportRow): ImportRow {
  const originalCategory = originalOf(row);
  const result = classify({ originalCategory, name: row.name, address: row.address });
  if (row.classification?.source === 'manual' && isCategoryKey(row.categoryKey)) {
    return { ...row, originalCategory, classification: { source: 'manual', reason: '가져오기 미리보기에서 직접 선택', needsReview: row.categoryKey === 'Idle', version: RULE_VERSION } };
  }
  return { ...row, originalCategory, ...result };
}
