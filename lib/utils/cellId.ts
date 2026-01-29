/**
 * 그리드 cellId 유틸리티
 * places 컬렉션에 cellId 필드를 추가하여 bounds 기반 쿼리에 활용
 * Firestore 'in' 쿼리(최대 30개)와 호환되는 그리드 크기 사용
 */

const CELL_SIZE = 0.01; // ~1.1km 그리드

/**
 * 위경도를 그리드 cellId로 변환
 * 예: (37.5665, 126.978) → "3756_12697"
 */
export function computeCellId(lat: number, lng: number): string {
  const cellLat = Math.floor(lat / CELL_SIZE);
  const cellLng = Math.floor(lng / CELL_SIZE);
  return `${cellLat}_${cellLng}`;
}

/**
 * 지도 bounds를 커버하는 모든 cellId 반환
 * 줌 레벨 9 이상에서만 마커 표시 (약 100셀 이하)
 */
export function getCellIdsForBounds(bounds: {
  sw: { lat: number; lng: number };
  ne: { lat: number; lng: number };
}): string[] | null {
  const minCellLat = Math.floor(bounds.sw.lat / CELL_SIZE);
  const maxCellLat = Math.floor(bounds.ne.lat / CELL_SIZE);
  const minCellLng = Math.floor(bounds.sw.lng / CELL_SIZE);
  const maxCellLng = Math.floor(bounds.ne.lng / CELL_SIZE);

  const cellCount = (maxCellLat - minCellLat + 1) * (maxCellLng - minCellLng + 1);

  // 줌 레벨 9 이상에서만 마커 표시 (약 100셀 이하)
  if (cellCount > 100) {
    return null;
  }

  const cellIds: string[] = [];
  for (let lat = minCellLat; lat <= maxCellLat; lat++) {
    for (let lng = minCellLng; lng <= maxCellLng; lng++) {
      cellIds.push(`${lat}_${lng}`);
    }
  }

  return cellIds;
}
