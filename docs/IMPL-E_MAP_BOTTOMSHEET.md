# E. 지도 메인 + 바텀시트

## 목표
네이버 지도에 장소 마커 표시 + 바텀시트로 간략 정보 + 상세 페이지 이동

## 구현 완료 ✅

### 1. 네이버 지도 SDK 로드
**파일**: `lib/naver/useNaverMaps.ts`
- SDK 동적 로드 (Script 컴포넌트 사용)
- 로드 완료 대기 및 초기화

### 2. NaverMapView 컴포넌트
**파일**: `components/map/NaverMapView.tsx`
- 지도 렌더링
- places 배열을 받아 마커 생성/관리
- 마커 클릭 시 `onMarkerClick(place)` 콜백
- bounds 변경 시 `onBoundsChange(bounds)` 콜백
- **마커 캐싱**: `markerMapRef`로 마커 재사용
- **가시성 관리**: 뷰포트 밖 마커 자동 숨김

### 3. 줌 게이트 + bounds 기반 로딩
**파일**: `app/page.tsx`, `lib/utils/cellId.ts`
- **줌 레벨 11 미만**: 마커 미표시 (셀 수 50개 초과 시)
- **줌 레벨 11 이상**: bounds 내 장소만 cellId 기반 로딩
- `idle` 이벤트에서만 쿼리 (드래그 중 쿼리 X)

```tsx
const handleBoundsChange = useCallback(async (bounds: MapBounds) => {
  const cellIds = getCellIdsForBounds(bounds);
  if (!cellIds) return; // 줌 아웃 상태

  const newCellIds = cellIds.filter(id => !loadedCellIdsRef.current.has(id));
  if (newCellIds.length === 0) return;

  const newPlaces = await getPlacesByCellIds(newCellIds);
  // ...
}, []);
```

### 4. cellId 인덱스
**파일**: `lib/utils/cellId.ts`
- places 문서에 `cellId` 필드 추가 완료
- Import/추가 시 자동 계산
- 쿼리: `where('cellId', 'in', cellIds)`

```typescript
const CELL_SIZE = 0.01; // ~1.1km 그리드

function computeCellId(lat: number, lng: number): string {
  const cellLat = Math.floor(lat / CELL_SIZE);
  const cellLng = Math.floor(lng / CELL_SIZE);
  return `${cellLat}_${cellLng}`;
}
```

### 5. 클라이언트 캐싱
**파일**: `app/page.tsx`
- `loadedPlaceIdsRef`: 이미 로드된 장소 ID 추적
- `loadedCellIdsRef`: 이미 쿼리한 셀 ID 추적
- 중복 요청 방지로 Firestore 비용 절감

### 6. 바텀시트
**파일**: `components/map/PlaceBottomSheet.tsx`
- 선택된 place 정보 표시
- 통계 요약 (리뷰 수, 최다 등급)
- "상세 보기" 버튼 → `/places/[placeId]` 이동

### 7. 검색/필터 기능
**파일**: `components/map/SearchBar.tsx`, `components/map/FilterPanel.tsx`
- 카테고리 필터
- 등급(S/A/B/C/F) 필터
- 지역 필터
- API: `/api/places/filter`

### 8. FAB 버튼 (장소 추가)
**파일**: `app/page.tsx`
```tsx
{(user?.role === 'member' || user?.role === 'owner') && (
  <Link href="/add" className="fixed bottom-4 right-4">
    + 장소 추가
  </Link>
)}
```

## 체크포인트
- [x] 지도 렌더링 및 마커 표시
- [x] 마커 클릭 → 바텀시트
- [x] 바텀시트 → 상세 페이지 이동
- [x] FAB 버튼 (member/owner만)
- [x] 줌 게이트 + bounds 로딩 (줌 11 이상)
- [x] cellId 인덱스
- [x] 클라이언트 캐싱
- [x] 검색/필터

## 참고 문서
- [REF_MAP_STRATEGY.md](REF_MAP_STRATEGY.md) - 지도 마커 전략 상세
- [02_DATA_MODEL.md](02_DATA_MODEL.md) - places 스키마
- 네이버 지도 API: https://navermaps.github.io/maps.js.ncp/
