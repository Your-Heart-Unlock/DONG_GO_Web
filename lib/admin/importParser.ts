import { NaverBookmarkExport, NaverBookmarkItem, ImportRow, ImportPreviewRow, ImportRowStatus } from '@/types';

/**
 * JSON 텍스트를 파싱하여 ImportRow 배열로 변환
 */
export function parseImportJSON(jsonText: string): ImportRow[] {
  try {
    const parsed = JSON.parse(jsonText);

    // 형태 A: Naver Bookmark Export { folder, bookmarkList }
    if (parsed.bookmarkList && Array.isArray(parsed.bookmarkList)) {
      return parseNaverBookmarkExport(parsed as NaverBookmarkExport);
    }

    // 형태 B: Plain ImportRow Array
    if (Array.isArray(parsed)) {
      return parsed as ImportRow[];
    }

    throw new Error('지원하지 않는 JSON 형식입니다. bookmarkList 배열 또는 ImportRow 배열이 필요합니다.');
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('유효하지 않은 JSON 형식입니다.');
    }
    throw error;
  }
}

/**
 * Naver Bookmark Export JSON을 ImportRow로 변환
 */
function parseNaverBookmarkExport(data: NaverBookmarkExport): ImportRow[] {
  return data.bookmarkList.map((bookmark: NaverBookmarkItem) => ({
    placeId: bookmark.sid,
    name: bookmark.name,
    address: bookmark.address,
    lat: bookmark.py, // py = latitude
    lng: bookmark.px, // px = longitude
    category: bookmark.mcidName, // 예: "음식점"
    categoryCode: bookmark.mcid, // 예: "DINING"
  }));
}

/**
 * ImportRow 배열을 검증하고 상태 분류
 */
export function validateImportRows(
  rows: ImportRow[],
  existingPlaceIds: Set<string>
): ImportPreviewRow[] {
  return rows.map((row) => {
    const status = determineRowStatus(row, existingPlaceIds);
    const reason = getValidationReason(row, status);

    return {
      row,
      status,
      reason,
    };
  });
}

/**
 * Row 상태 판정
 */
function determineRowStatus(
  row: ImportRow,
  existingPlaceIds: Set<string>
): ImportRowStatus {
  // 필수 필드 체크
  if (!row.placeId || !row.name || !row.address) {
    return 'INVALID';
  }

  // 좌표 유효성 체크
  if (
    typeof row.lat !== 'number' ||
    typeof row.lng !== 'number' ||
    row.lat < -90 ||
    row.lat > 90 ||
    row.lng < -180 ||
    row.lng > 180
  ) {
    return 'INVALID';
  }

  // 중복 체크
  if (existingPlaceIds.has(row.placeId)) {
    return 'DUPLICATE';
  }

  return 'OK';
}

/**
 * 검증 실패 사유 반환
 */
function getValidationReason(row: ImportRow, status: ImportRowStatus): string | undefined {
  if (status === 'OK' || status === 'DUPLICATE') {
    return undefined;
  }

  if (!row.placeId) return '장소 ID(placeId) 누락';
  if (!row.name) return '장소명(name) 누락';
  if (!row.address) return '주소(address) 누락';

  if (typeof row.lat !== 'number' || typeof row.lng !== 'number') {
    return '좌표 형식 오류';
  }

  if (row.lat < -90 || row.lat > 90) {
    return `위도 범위 오류 (${row.lat})`;
  }

  if (row.lng < -180 || row.lng > 180) {
    return `경도 범위 오류 (${row.lng})`;
  }

  return '알 수 없는 오류';
}

/**
 * Preview 요약 계산
 */
export function calculatePreviewSummary(previewRows: ImportPreviewRow[]) {
  const summary = {
    total: previewRows.length,
    ok: 0,
    duplicate: 0,
    invalid: 0,
  };

  previewRows.forEach((row) => {
    if (row.status === 'OK') summary.ok++;
    else if (row.status === 'DUPLICATE') summary.duplicate++;
    else if (row.status === 'INVALID') summary.invalid++;
  });

  return summary;
}
