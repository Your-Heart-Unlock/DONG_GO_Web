# 지도 마커 로딩 전략

## 현재 구현 (요약)

**줌 게이트 + bounds 기반 로딩(그리드 cellId) + 클라이언트 캐싱**

- 줌 레벨 11 미만: 마커 미표시 (성능/비용 절감)
- 줌 레벨 11 이상: 현재 화면(bounds) 안의 장소를 cellId 기반으로 Firestore에서 로딩

---

## 1. 줌 기준 로딩/표시

네이버 지도 SDK의 `idle` 이벤트에서 bounds를 얻어 처리.

| 줌 레벨 | 동작 |
|---------|------|
| `< 11` | 쿼리 안 함, 마커 숨김 |
| `>= 11` | bounds 기반 cellId 쿼리 → 마커 표시 |

**구현 포인트:**
- `idle` 이벤트에서만 쿼리 (드래그 중 쿼리 X)
- 셀 수 50개 초과 시 쿼리하지 않음 (줌 레벨 11 기준)

---

## 2. 그리드 cellId 인덱스

Firestore는 bounds 쿼리를 직접 지원하지 않으므로 그리드 방식 사용.

### cellId 계산

```typescript
const CELL_SIZE = 0.01; // ~1.1km 그리드

function computeCellId(lat: number, lng: number): string {
  const cellLat = Math.floor(lat / CELL_SIZE);
  const cellLng = Math.floor(lng / CELL_SIZE);
  return `${cellLat}_${cellLng}`;
}
```

### bounds → cellId 목록

```typescript
function getCellIdsForBounds(bounds): string[] | null {
  // bounds 안에 걸치는 모든 cellId 계산
  // 셀 수 > 50이면 null 반환 (줌 아웃 상태)
}
```

### Firestore 쿼리

```typescript
// cellIds 배열을 30개씩 나눠서 쿼리 (Firestore 'in' 제한)
where('cellId', 'in', cellIds.slice(0, 30))
```

---

## 3. 클라이언트 캐싱

### 이미 로드된 장소 캐싱

```typescript
const loadedPlaceIdsRef = useRef<Set<string>>(new Set());
const loadedCellIdsRef = useRef<Set<string>>(new Set());
```

- 이미 로드된 cellId는 재요청하지 않음
- 이미 로드된 placeId는 중복 추가하지 않음
- 필터 적용/해제 시 캐시 초기화

### 마커 캐싱

```typescript
const markerMapRef = useRef<Map<string, naver.maps.Marker>>(new Map());
```

- placeId → marker 매핑 유지
- 불필요한 마커 재생성 방지
- 뷰포트 밖 마커는 `setVisible(false)`로 숨김

---

## 4. 줌 레벨별 UX

| 줌 레벨 | 표시 | Firestore 읽기 |
|---------|------|---------------|
| `< 11` | 마커 미표시 | 0 |
| `>= 11` | bounds 내 장소 로딩 + 개별 마커 | 필요한 만큼 |

**효과:**
- 초기 로딩 폭발 없음
- 확대할수록 정보가 드릴다운되는 자연스러운 UX
- Firestore 읽기 비용 최소화

---

## 5. places 컬렉션 구조

| 필드 | 타입 | 설명 |
|------|------|------|
| `lat` | number | 위도 |
| `lng` | number | 경도 |
| `cellId` | string | 그리드 셀 ID (`cellLat_cellLng`) |
| `name` | string | 장소 이름 |
| `address` | string | 주소 |
| `category` | string | 카테고리 |
| `status` | string | 상태 (active/hidden/deleted) |
| ... | | 기타 필드 |

---

## 6. 구현 체크리스트

- [x] `places` 컬렉션에 `cellId` 필드 추가
- [x] Import 시 cellId 자동 계산하여 저장
- [x] 장소 추가 시 cellId 자동 생성
- [x] 지도 이벤트 처리:
  - [x] `idle` 이벤트에서만 로딩
  - [x] 줌 기준 게이트 적용 (줌 11 이상)
- [x] 로딩 결과 클라이언트 캐시
- [x] 마커 가시성 관리 (뷰포트 기반)

---

## 7. 향후 개선 가능 사항

- 마커 수가 많아지면 클러스터링 도입 검토
- place_markers 경량 컬렉션 분리 (읽기 비용 추가 절감)
- Geohash 방식으로 전환 (더 정교한 범위 쿼리)
