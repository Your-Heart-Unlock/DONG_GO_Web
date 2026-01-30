# IMPL-X: 메인 지도 키워드 검색

> **우선순위**: P1 (핵심 기능)
> **예상 소요**: 0.5일
> **상태**: 완료
> **관련 섹션**: CHECKLIST.md E섹션 (검색 UI)

---

## 1. 개요 및 목표

### 문제점
- 메인 지도의 검색바가 존재하지만 실제 검색 기능 미연동 (alert만 표시)
- DB에 등록된 장소를 빠르게 찾을 수 없음
- 검색 결과가 없을 때 장소 추가 페이지로의 동선이 없음

### 목표
- SearchBar에 키워드 입력 시 DB 장소 실시간 검색 (이름/주소)
- 드롭다운으로 검색 결과 표시 + 클릭 시 지도 이동 + 바텀시트 표시
- 결과 없을 시 "식당 추가 검색하기" 버튼 → `/add?q=검색어`로 이동
- `/add` 페이지에서 `?q=` 파라미터 자동 검색 실행

### 성공 지표
- 키워드 입력 300ms 후 자동 검색
- 결과 클릭 시 지도가 해당 위치(zoom 16)로 이동 + 바텀시트 열림
- 결과 없을 때 장소 추가 동선 원활

---

## 2. 검색 API

### `GET /api/places/search`

**파일**: `app/api/places/search/route.ts`

**쿼리 파라미터**:
| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| keyword | string | (필수) | 검색 키워드 |
| limit | number | 10 | 최대 결과 수 |

**동작**:
1. `status == 'active'`인 전체 장소 조회
2. `name` 또는 `address`에 키워드 포함 여부로 필터 (대소문자 무시)
3. 정렬: 이름이 키워드로 시작하는 결과 우선, 이름에 포함된 결과 그 다음
4. `limit`개로 자르기

**응답**:
```json
{
  "places": [
    {
      "placeId": "...",
      "name": "맥도날드 강남점",
      "address": "서울 강남구 ...",
      "lat": 37.123,
      "lng": 127.456,
      "category": "패스트푸드",
      "categoryKey": "West"
    }
  ],
  "total": 3
}
```

**특징**:
- 인증 불필요 (places는 public read)
- `inferCategoryKey()`로 categoryKey 자동 추론

---

## 3. SearchBar 컴포넌트

**파일**: `components/map/SearchBar.tsx`

### 새로운 Props

```typescript
export interface SearchResultItem {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  categoryKey?: string;
}

interface SearchBarProps {
  placeholder?: string;
  onFilterChange?: (filterState: FilterState) => void;
  // 검색 드롭다운
  searchResults?: SearchResultItem[];
  searchLoading?: boolean;
  searchTotal?: number;
  onResultClick?: (result: SearchResultItem) => void;
  onAddSearchClick?: (query: string) => void;
  onQueryChange?: (query: string) => void;
}
```

### 드롭다운 UI 동작

- **입력 시**: 300ms 디바운스 → `onQueryChange(query)` 호출
- **결과 있음**: 이름 + 카테고리 뱃지 + 주소 표시, `{total}건 중 {length}건 표시`
- **결과 없음**: "검색 결과가 없습니다" + "식당 추가 검색하기" 버튼
- **로딩 중**: "검색 중..." 표시
- **결과 클릭**: input에 이름 채움 + 드롭다운 닫기 + `onResultClick(result)` 호출
- **외부 클릭**: 드롭다운 닫기
- **필터 패널 열림**: 드롭다운 닫기
- **클리어 버튼**: 드롭다운도 닫기
- **포커스 복귀**: 이전 결과가 있으면 드롭다운 재표시

---

## 4. 메인 페이지 연동

**파일**: `app/page.tsx`

### 검색 상태
```typescript
const [searchResults, setSearchResults] = useState<SearchResultItem[]>();
const [searchLoading, setSearchLoading] = useState(false);
const [searchTotal, setSearchTotal] = useState<number>();
const pendingSelectRef = useRef<string | null>(null);
```

### 핸들러

| 핸들러 | 동작 |
|--------|------|
| `handleQueryChange(query)` | `/api/places/search?keyword=...` 호출 → 결과 setState |
| `handleResultClick(result)` | `setMapCenter` + `setMapZoom(16)` + 바텀시트 표시 |
| `handleAddSearchClick(query)` | `router.push('/add?q=...')` |

### 지연 선택 (Pending Select)

검색 결과 클릭 시 해당 장소가 아직 지도에 로드되지 않았을 수 있음:
1. `places` 배열에서 `placeId`로 검색
2. 있으면 즉시 `setSelectedPlace()`
3. 없으면 `pendingSelectRef.current`에 저장
4. `useEffect`에서 `places` 변경 감지 → pending placeId 발견 시 자동 선택

---

## 5. 장소 추가 페이지 `?q=` 지원

**파일**: `app/add/page.tsx`

### 변경 사항

- `useSearchParams()`로 `?q=` 파라미터 읽기
- 검색 로직을 `performSearch(query)` 함수로 분리
- `useEffect`에서 `?q=` 존재 시 자동으로 `setQuery(q)` + `performSearch(q)` 호출
- `Suspense` 래퍼 추가 (`useSearchParams` 요구사항)

### 컴포넌트 구조 변경

```
// before
export default function AddPlacePage() { ... }

// after
function AddPlaceContent() { ... }       // 실제 로직 (useSearchParams 사용)
export default function AddPlacePage() {  // Suspense 래퍼
  return <Suspense fallback={...}><AddPlaceContent /></Suspense>
}
```

---

## 6. 수정 파일 목록

| 파일 | 변경 유형 | 설명 |
|------|----------|------|
| `app/api/places/search/route.ts` | **신규** | DB 키워드 검색 API |
| `components/map/SearchBar.tsx` | 수정 | 드롭다운 결과 UI, 새 props 추가 |
| `app/page.tsx` | 수정 | 검색 상태/핸들러, useRouter 추가 |
| `app/add/page.tsx` | 수정 | `?q=` 자동 검색, Suspense 래핑 |

---

## 7. 플로우 요약

```
[메인 지도]
  ↓ 키워드 입력 (300ms 디바운스)
  ↓ GET /api/places/search?keyword=...
  ↓
  ├── 결과 있음 → 드롭다운에 목록 표시
  │     ↓ 결과 클릭
  │     ↓ 지도 zoom 16으로 이동 + 바텀시트 표시
  │
  └── 결과 없음 → "식당 추가 검색하기" 버튼
        ↓ 버튼 클릭
        ↓ /add?q=검색어 이동
        ↓ 카카오 검색 API로 자동 검색 실행
```
