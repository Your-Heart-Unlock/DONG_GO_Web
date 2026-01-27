# E. 지도 메인 + 바텀시트

## 목표
네이버 지도에 장소 마커 표시 + 바텀시트로 간략 정보 + 상세 페이지 이동

## 구현 완료 ✅

### 1. 네이버 지도 SDK 로드
**파일**: `app/layout.tsx` (head에 스크립트 추가)
```tsx
<script
  src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${process.env.NEXT_PUBLIC_NAVER_CLIENT_ID}`}
></script>
```

**훅**: `lib/naver/useNaverMaps.ts`
- SDK 로드 대기 및 초기화
- 지도 인스턴스 반환

### 2. NaverMapView 컴포넌트
**파일**: `components/map/NaverMapView.tsx`
- 지도 렌더링
- places 배열을 받아 마커 생성
- 마커 클릭 시 `onMarkerClick(place)` 콜백

### 3. 장소 데이터 로딩
**파일**: `app/page.tsx`
```tsx
const [places, setPlaces] = useState<Place[]>([]);

useEffect(() => {
  async function loadPlaces() {
    const data = await getRecentPlaces(100); // 최근 100개
    setPlaces(data);
  }
  loadPlaces();
}, []);
```

### 4. 바텀시트
**파일**: `components/map/PlaceBottomSheet.tsx`
- 선택된 place 정보 표시
- 통계 요약 (리뷰 수, 최다 등급)
- "상세 보기" 버튼 → `/places/[placeId]` 이동

### 5. 검색 UI (API 미연동)
**파일**: `components/map/SearchBar.tsx`
- 검색 input만 구현
- 실제 API 연동은 향후 작업

### 6. FAB 버튼 (장소 추가)
**파일**: `app/page.tsx`
```tsx
{(user?.role === 'member' || user?.role === 'owner') && (
  <Link href="/add" className="fixed bottom-4 right-4">
    + 장소 추가
  </Link>
)}
```

## 미구현 항목 ⚠️

### 1. 줌 게이트 + bounds 기반 로딩
**목표**: 성능 최적화 및 읽기 비용 절감
- 줌 < 14: 마커 로딩 안 함 (또는 클러스터만)
- 줌 >= 14: 현재 화면(bounds) 내 장소만 로딩
- 드래그 중 쿼리 안 함, `idle` 이벤트 + 500ms 디바운스

**구현 방법**:
```tsx
map.addListener('idle', debounce(() => {
  const zoom = map.getZoom();
  if (zoom >= 14) {
    const bounds = map.getBounds();
    // bounds 내 장소 쿼리
  }
}, 500));
```

### 2. places에 geohash/cellId 추가
**목표**: Firestore bounds 쿼리 지원

**옵션 A: cellId (MVP 추천)**
```typescript
const cellSize = 0.01;
const cellLat = Math.floor(lat / cellSize);
const cellLng = Math.floor(lng / cellSize);
const cellId = `${cellLat}_${cellLng}`;
```
- places 문서에 `cellId` 필드 추가
- Import 시 자동 계산
- 쿼리: `where('cellId', 'in', [...])`

**옵션 B: geohash**
- `geohash` npm 패키지 사용
- range 쿼리: `where('geohash', '>=', prefix)` & `<= prefix + '~'`

### 3. 마커 클러스터링
**목표**: 렌더링 성능 향상 (300+ 마커 시)

**라이브러리**: 
- `@googlemaps/markerclusterer` (Naver에도 적용 가능)
- 또는 네이버 지도 공식 클러스터링 플러그인

**적용 시점**: bounds 로딩 후 마커 수가 많을 때

### 4. 검색/필터 기능
- 카테고리 필터 (한식, 양식, 카페 등)
- 지역 필터
- Firestore 쿼리: `where('category', '==', category)`

## 체크포인트
- [x] 지도 렌더링 및 마커 표시
- [x] 마커 클릭 → 바텀시트
- [x] 바텀시트 → 상세 페이지 이동
- [x] FAB 버튼 (member/owner만)
- [ ] 줌 게이트 + bounds 로딩
- [ ] cellId 또는 geohash 인덱스
- [ ] 마커 클러스터링
- [ ] 검색/필터

## 참고 문서
- [REF_MAP_STRATEGY.md](REF_MAP_STRATEGY.md) - 지도 마커 전략 상세
- [02_DATA_MODEL.md](02_DATA_MODEL.md) - places 스키마
- 네이버 지도 API: https://navermaps.github.io/maps.js.ncp/
