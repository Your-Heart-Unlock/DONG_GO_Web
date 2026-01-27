# 지도 마커 로딩 & 클러스터링 전략

## 추천 아키텍처 (결론)

**줌 게이트 + bounds 기반 로딩(그리드 cellId) + 클러스터링(렌더링용) + place_markers 컬렉션**

- 줌이 낮을 때 (overview): 마커 개별 렌더 X → 클러스터(또는 타일 기반 집계)만 표시
- 줌이 높을 때 (detail): 현재 화면(bounds) 안의 장소만 Firestore에서 로딩 → 개별 마커 렌더 O (많으면 클러스터 ON)

성능 / 비용 / UX를 동시에 만족하는 방식.

---

## 1. 줌 기준 로딩/표시

네이버 지도 SDK에서 줌 이벤트와 bounds를 모두 얻을 수 있으므로 가능.

| 줌 레벨 | 동작 |
|---------|------|
| `zoom < Z_THRESHOLD` | 쿼리 안 함 (읽기 0) 또는 집계 데이터만 쿼리 |
| `zoom >= Z_THRESHOLD` | bounds 기반으로 `place_markers` 쿼리 → 마커 표시 |

**주의사항:**
- 드래그 중에는 쿼리하지 않음
- 이동이 끝나는 이벤트(`idle`)에서만 쿼리
- **500ms 디바운스** 적용

---

## 2. DB 변경: 지오 인덱스 추가

Firestore는 bounds 쿼리를 직접 지원하지 않으므로, 아래 방식 중 하나를 사용.

### 옵션 A: Geohash + range query (구현 난이도 중)

`places`에 필드 추가:
- `geohash` (string)
- `geo` (GeoPoint)

현재 bounds를 커버하는 geohash prefix 목록을 계산하여 prefix별 range 쿼리:
```
where('geohash', '>=', prefix) & <= prefix + '~'
```
결과 합치기 (중복 제거).

- 장점: Firestore만으로 해결, 표준 패턴
- 단점: bounds → prefix 계산 로직 필요

### 옵션 B: 그리드(cell) 인덱스 (MVP 추천, 난이도 낮)

한국 지역 서비스에 특히 적합.

`places`에 필드 추가:
- `cellId` (string)

```typescript
const cellSize = 0.01; // 줌 14 기준 약 0.01도 그리드
const cellLat = Math.floor(lat / cellSize);
const cellLng = Math.floor(lng / cellSize);
const cellId = `${cellLat}_${cellLng}`;
```

bounds 안에 걸치는 cellId 목록을 계산하여:
```
where('cellId', 'in', [...cellIds])
```

- 장점: 구현이 가장 쉬움, 지인 규모 서비스에 충분히 실용적
- 단점: `in` 쿼리 제한 (한 번에 30개) → 큰 bounds에서는 쿼리를 나눠야 함

### 옵션 C: 서버에서 집계/타일 제공

Cloud Run/Functions에서 bounds/zoom을 받아 서버가 계산 후 최소 데이터만 반환.

- 장점: DB 구조 변경 최소화
- 단점: 서버 운영/비용/구현 부담 큼

### 선택: **옵션 B (그리드 cellId)**

MVP를 빠르게 안정화하고, 필요 시 옵션 A로 전환.

---

## 3. 클러스터링

범위 로딩을 해도 한 화면에 300~1,000개면 렌더가 느려질 수 있음.

**클러스터링의 역할:**
- 렌더링 성능 향상
- 시각적 가독성 확보

**주의:**
- 클러스터링은 Firestore **읽기 비용**을 줄여주지 못함 (읽은 뒤 묶는 것)
- 읽기 비용 절감은 **줌 게이트 + 범위 로딩**이 담당

→ 클러스터링과 줌 게이트는 역할이 다르며, **함께 사용**하는 것이 맞음.

---

## 4. 줌 레벨별 UX 플로우

| 줌 레벨 | 표시 | Firestore 읽기 |
|---------|------|---------------|
| `< 13` | 마커 미표시 (또는 "확대하세요" 안내) | 0 |
| `13 ~ 14` | 클러스터만 표시 (가능하면 집계 컬렉션 활용) | 최소 |
| `>= 15` | bounds 내 `place_markers` 로딩 + 개별 마커 | 필요한 만큼 |
| `>= 15` & 마커 > 300 | 개별 마커 + 클러스터 ON | 필요한 만큼 |

**효과:**
- 초기 로딩 폭발 없음
- 사용자가 확대할수록 정보가 "드릴다운"되는 자연스러운 UX

---

## 5. place_markers 컬렉션 (경량 마커 전용)

지도 렌더링용으로 `places` 문서 전체를 읽는 대신, 최소 필드만 가진 경량 컬렉션을 별도 운용.

### `place_markers/{placeId}`

| 필드 | 타입 | 설명 |
|------|------|------|
| `lat` | number | 위도 |
| `lng` | number | 경도 |
| `cellId` | string | 그리드 셀 ID (`cellLat_cellLng`) |
| `name` | string | 장소 이름 |
| `category` | string | 카테고리 |
| `regionKey` | string | 지역 구분 키 (선택) |
| `updatedAt` | timestamp | 마지막 업데이트 |

- **상세 페이지**는 `places/{placeId}`만 읽음
- **지도**는 `place_markers`만 읽음

**효과:**
- 읽기 비용 ↓
- 전송량 ↓
- 렌더 준비 속도 ↑

---

## 6. 구현 체크리스트

- [ ] `place_markers` 컬렉션 생성 (lat/lng + cellId + minimal fields)
- [ ] Import 시 cellId 계산하여 저장 (또는 마이그레이션 스크립트 1회)
- [ ] 장소 추가(`user_added`) 시 `place_markers` 동시 생성
- [ ] 지도 이벤트 처리:
  - [ ] `idle` 이벤트에서만 로딩
  - [ ] 500ms 디바운스
  - [ ] 줌 기준 게이트 적용 (13 / 15)
- [ ] 로딩 결과 클라이언트 캐시 (`Map<placeId, marker>`) → 같은 bounds 재요청 방지
- [ ] 마커 개수 > N 일 때 클러스터링 ON
- [ ] `places` 문서에 `cellId`, `geo` 필드 추가 (데이터 모델 반영)
