import { ImportRow, Classification, OriginalCategory } from '@/types';
import { getImportRowError } from './importParser';
import { isProtectedCategory, prepareImport } from './classification';

export interface ExistingImportPlace {
  placeId: string; name?: string; address?: string; lat?: number; lng?: number;
  mapProvider?: string; source?: string; naverPlaceId?: string; kakaoPlaceId?: string;
  categoryKey?: string; classification?: Classification;
  categoryCode?: string; originalCategory?: OriginalCategory;
  category?: string;
}
const normalized = (s = '') => s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}]/gu, '');
export function findImportMatch(row: ImportRow, places: ExistingImportPlace[]) {
  const naver = (p: ExistingImportPlace) => p.mapProvider === 'naver' || (!p.mapProvider && p.source === 'naver_import');
  const exact = places.find(p => p.naverPlaceId === row.placeId || (p.placeId === row.placeId && naver(p)));
  if (exact) return { place: exact, kind: 'exact' as const };
  const possible = places.find(p => p.placeId === row.placeId || (normalized(p.name) === normalized(row.name) && (
    normalized(p.address) === normalized(row.address) ||
    (Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.hypot((p.lat! - row.lat) * 111000, (p.lng! - row.lng) * 88000) <= 30)
  )));
  return possible ? { place: possible, kind: 'possible' as const } : undefined;
}
export function planImport(rows: ImportRow[], existing: ExistingImportPlace[]) {
  const seen = new Set<string>();
  const candidates = [...existing];
  return rows.map(input => {
    const error = getImportRowError(input);
    if (error) return { row: input, status: 'INVALID' as const, reason: error };
    const row = prepareImport(input);
    if (seen.has(row.placeId)) return { row, status: 'INVALID' as const, reason: '파일 내 중복 ID' };
    seen.add(row.placeId);
    const match = findImportMatch(row, candidates);
    if (!match) {
      candidates.push({ ...row, mapProvider: 'naver', source: 'naver_import' });
      return { row, status: 'OK' as const };
    }
    return { row, status: 'DUPLICATE' as const, targetId: match.place.placeId, matchKind: match.kind,
      existingCategoryKey: match.place.categoryKey || 'Idle',
      preserveCategory: isProtectedCategory(match.place),
      reason: match.kind === 'possible' ? '동일 장소 후보/제공자 ID 충돌: 자동 등록·업데이트 제외, 별도 확인 필요' :
        isProtectedCategory(match.place) ? '기존 수동/출처 없는 명시적 분류 보존' : '동일 네이버 ID' };
  });
}
