# IMPL-N: 스마트 검색 & 필터

> **우선순위**: P1 (핵심 기능)  
> **예상 소요**: 2일  
> **관련 섹션**: CHECKLIST.md N섹션, FEATURE_IDEAS.md Phase 1.2

---

## 1. 개요 및 목표

### 문제점
- 현재는 키워드 검색만 가능 (카카오 API 연동)
- 100개 장소 중에서 원하는 조건으로 필터링 불가능
- "한식만 보기", "S등급만 보기", "미방문 장소만" 같은 기능 없음

### 목표
- 카테고리/등급/지역별 다중 필터
- 내가 안 가본 곳, 가고 싶어요 한 곳 필터
- 정렬 옵션 (최신순, 평점순, 리뷰 많은 순)
- 필터 적용 시 지도 마커 실시간 업데이트
- URL에 필터 상태 저장 (공유/북마크 가능)

### 성공 지표
- 필터 조합으로 원하는 장소를 3초 내 찾을 수 있음
- 지도 마커가 필터와 동기화됨
- 모바일에서도 필터 패널 사용이 편리함

---

## 2. 데이터 모델

### SearchQuery 인터페이스
```typescript
// types/index.ts에 추가
export interface SearchQuery {
  // 키워드
  keyword?: string; // 장소 이름, 주소 검색
  
  // 카테고리
  categories?: string[]; // ["한식", "일식", "카페"]
  
  // 등급
  tiers?: RatingTier[]; // ["S", "A"]
  
  // 지역
  regions?: string[]; // ["강남", "홍대", "성수"] - 주소에서 추출
  
  // 리뷰 수
  minReviews?: number; // 예: 3개 이상만
  
  // 사용자별 필터
  wishOnly?: boolean; // 내가 가고 싶어요 한 곳만
  unvisitedOnly?: boolean; // 내가 아직 리뷰 안 쓴 곳만
  
  // 정렬
  sortBy?: 'recent' | 'rating' | 'reviews' | 'wishes';
  sortOrder?: 'asc' | 'desc';
}

export interface FilterState extends SearchQuery {
  isActive: boolean; // 필터가 적용 중인지
  activeCount: number; // 활성화된 필터 개수
}
```

### Places 컬렉션 인덱스 추가
```
// Firestore 복합 인덱스 필요
places
  - category (ascending/descending)
  - createdAt (ascending/descending)
  
places
  - category (ascending/descending)
  - status (ascending)
  
// 등급별 정렬은 stats 서브컬렉션 조인 필요 (클라이언트 처리)
```

---

## 3. API 설계

### GET /api/search/places
**Query Parameters**:
```typescript
{
  keyword?: string;
  categories?: string; // comma-separated: "한식,일식"
  tiers?: string; // comma-separated: "S,A"
  regions?: string; // comma-separated: "강남,홍대"
  minReviews?: number;
  wishOnly?: boolean;
  unvisitedOnly?: boolean;
  sortBy?: string;
  sortOrder?: string;
  uid?: string; // 사용자별 필터용
}
```

**Response**:
```typescript
{
  places: Place[];
  stats: {
    totalCount: number;
    filteredCount: number;
    categoryCounts: { [category: string]: number };
    tierCounts: { [tier: string]: number };
  };
}
```

**구현 전략**:
```typescript
// app/api/search/places/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // 1. Query 파라미터 파싱
  const query: SearchQuery = {
    keyword: searchParams.get('keyword') || undefined,
    categories: searchParams.get('categories')?.split(','),
    tiers: searchParams.get('tiers')?.split(',') as RatingTier[],
    // ...
  };
  
  // 2. Firestore 쿼리 구성
  let placesQuery = db.collection('places')
    .where('status', '==', 'active');
  
  // 카테고리 필터
  if (query.categories?.length) {
    placesQuery = placesQuery.where('category', 'in', query.categories);
  }
  
  // 3. 클라이언트 필터링
  const snapshot = await placesQuery.get();
  let places = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // 등급 필터 (stats 조인 필요)
  if (query.tiers?.length) {
    const placeIds = places.map(p => p.placeId);
    const statsPromises = placeIds.map(id => 
      db.collection('stats').doc(id).get()
    );
    const statsSnapshot = await Promise.all(statsPromises);
    
    const placeStatsMap = new Map();
    statsSnapshot.forEach((doc, idx) => {
      if (doc.exists) {
        placeStatsMap.set(placeIds[idx], doc.data());
      }
    });
    
    places = places.filter(place => {
      const stats = placeStatsMap.get(place.placeId);
      if (!stats) return false;
      return query.tiers.includes(stats.avgTier);
    });
  }
  
  // 키워드 검색
  if (query.keyword) {
    const keyword = query.keyword.toLowerCase();
    places = places.filter(p => 
      p.name.toLowerCase().includes(keyword) ||
      p.address.toLowerCase().includes(keyword)
    );
  }
  
  // 지역 필터
  if (query.regions?.length) {
    places = places.filter(p => 
      query.regions.some(region => p.address.includes(region))
    );
  }
  
  // 4. 사용자별 필터
  if (query.uid) {
    // wishOnly
    if (query.wishOnly) {
      const wishSnapshot = await db.collection('wishes')
        .where('uid', '==', query.uid)
        .get();
      const wishPlaceIds = new Set(
        wishSnapshot.docs.map(doc => doc.data().placeId)
      );
      places = places.filter(p => wishPlaceIds.has(p.placeId));
    }
    
    // unvisitedOnly
    if (query.unvisitedOnly) {
      const reviewSnapshot = await db.collection('reviews')
        .where('uid', '==', query.uid)
        .get();
      const visitedPlaceIds = new Set(
        reviewSnapshot.docs.map(doc => doc.data().placeId)
      );
      places = places.filter(p => !visitedPlaceIds.has(p.placeId));
    }
  }
  
  // 5. 정렬
  // ... sorting logic
  
  return NextResponse.json({ places, stats });
}
```

---

## 4. UI/UX 구현

### 4.1 FilterButton (SearchBar에 추가)
```tsx
// components/map/SearchBar.tsx
'use client';

import { useState } from 'react';
import FilterPanel from './FilterPanel';

export default function SearchBar() {
  const [showFilters, setShowFilters] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    isActive: false,
    activeCount: 0,
  });

  return (
    <div className="absolute top-4 left-4 right-4 z-10">
      <div className="flex gap-2">
        {/* 기존 검색 입력 */}
        <input
          type="text"
          placeholder="장소 검색..."
          className="flex-1 px-4 py-3 rounded-lg shadow-lg"
        />
        
        {/* 필터 버튼 */}
        <button
          onClick={() => setShowFilters(true)}
          className="px-4 py-3 bg-white rounded-lg shadow-lg flex items-center gap-2"
        >
          🔍 필터
          {filterState.activeCount > 0 && (
            <span className="bg-blue-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
              {filterState.activeCount}
            </span>
          )}
        </button>
      </div>
      
      {/* 필터 패널 */}
      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filterState={filterState}
        onFilterChange={setFilterState}
      />
    </div>
  );
}
```

### 4.2 FilterPanel (슬라이드 오버)
```tsx
// components/map/FilterPanel.tsx
'use client';

import { useState, useEffect } from 'react';
import { SearchQuery, FilterState } from '@/types';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filterState: FilterState;
  onFilterChange: (state: FilterState) => void;
}

export default function FilterPanel({
  isOpen,
  onClose,
  filterState,
  onFilterChange,
}: FilterPanelProps) {
  const [query, setQuery] = useState<SearchQuery>({});
  const [counts, setCounts] = useState<any>({});

  useEffect(() => {
    if (isOpen) {
      // 카테고리별/등급별 개수 가져오기
      fetchFilterCounts();
    }
  }, [isOpen]);

  const handleApply = () => {
    const activeCount = Object.values(query).filter(v => 
      v !== undefined && v !== null && 
      (Array.isArray(v) ? v.length > 0 : true)
    ).length;
    
    onFilterChange({
      ...query,
      isActive: activeCount > 0,
      activeCount,
    });
    onClose();
  };

  const handleReset = () => {
    setQuery({});
    onFilterChange({
      isActive: false,
      activeCount: 0,
    });
  };

  return (
    <>
      {/* 배경 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* 슬라이드 패널 */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-bold">필터</h2>
            <button onClick={onClose} className="text-2xl">×</button>
          </div>
          
          {/* 필터 옵션들 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 카테고리 */}
            <FilterGroup label="카테고리">
              {CATEGORIES.map(cat => (
                <Checkbox
                  key={cat}
                  label={`${cat} (${counts[cat] || 0})`}
                  checked={query.categories?.includes(cat)}
                  onChange={(checked) => {
                    const categories = checked
                      ? [...(query.categories || []), cat]
                      : query.categories?.filter(c => c !== cat);
                    setQuery({ ...query, categories });
                  }}
                />
              ))}
            </FilterGroup>
            
            {/* 등급 */}
            <FilterGroup label="등급">
              <div className="flex gap-2 flex-wrap">
                {['S', 'A', 'B', 'C', 'F'].map(tier => (
                  <Chip
                    key={tier}
                    tier={tier as RatingTier}
                    selected={query.tiers?.includes(tier as RatingTier)}
                    count={counts.tiers?.[tier] || 0}
                    onClick={() => {
                      const tiers = query.tiers?.includes(tier as RatingTier)
                        ? query.tiers.filter(t => t !== tier)
                        : [...(query.tiers || []), tier as RatingTier];
                      setQuery({ ...query, tiers });
                    }}
                  />
                ))}
              </div>
            </FilterGroup>
            
            {/* 지역 */}
            <FilterGroup label="지역">
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={query.regions?.[0] || ''}
                onChange={(e) => {
                  const regions = e.target.value ? [e.target.value] : undefined;
                  setQuery({ ...query, regions });
                }}
              >
                <option value="">전체</option>
                <option value="강남">강남</option>
                <option value="홍대">홍대</option>
                <option value="성수">성수</option>
                <option value="신촌">신촌</option>
                <option value="이태원">이태원</option>
              </select>
            </FilterGroup>
            
            {/* 기타 옵션 */}
            <FilterGroup label="기타">
              <Switch
                label="내가 안 가본 곳만"
                checked={query.unvisitedOnly || false}
                onChange={(checked) => 
                  setQuery({ ...query, unvisitedOnly: checked })
                }
              />
              <Switch
                label="가고 싶어요 한 곳만"
                checked={query.wishOnly || false}
                onChange={(checked) => 
                  setQuery({ ...query, wishOnly: checked })
                }
              />
            </FilterGroup>
            
            {/* 정렬 */}
            <FilterGroup label="정렬">
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={query.sortBy || 'recent'}
                onChange={(e) => 
                  setQuery({ ...query, sortBy: e.target.value as any })
                }
              >
                <option value="recent">최신순</option>
                <option value="rating">평점순</option>
                <option value="reviews">리뷰 많은 순</option>
                <option value="wishes">가고 싶어요 많은 순</option>
              </select>
            </FilterGroup>
          </div>
          
          {/* 하단 버튼 */}
          <div className="p-4 border-t flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-3 border rounded-lg"
            >
              초기화
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg"
            >
              적용
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// 하위 컴포넌트들
function FilterGroup({ label, children }: any) {
  return (
    <div>
      <h3 className="font-semibold mb-2">{label}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Checkbox({ label, checked, onChange }: any) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4"
      />
      <span>{label}</span>
    </label>
  );
}

function Switch({ label, checked, onChange }: any) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span>{label}</span>
      <div
        className={`w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-blue-500' : 'bg-gray-300'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow transition-transform transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          } mt-0.5`}
        />
      </div>
    </label>
  );
}

function Chip({ tier, selected, count, onClick }: any) {
  const colors = {
    S: 'purple',
    A: 'blue',
    B: 'green',
    C: 'orange',
    F: 'red',
  };
  const color = colors[tier];
  
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm font-semibold ${
        selected
          ? `bg-${color}-500 text-white`
          : `bg-${color}-100 text-${color}-700`
      }`}
    >
      {tier} ({count})
    </button>
  );
}
```

### 4.3 지도 마커 연동
```tsx
// components/map/NaverMapView.tsx에 필터 적용
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function NaverMapView() {
  const searchParams = useSearchParams();
  const [filteredPlaces, setFilteredPlaces] = useState<Place[]>([]);
  
  useEffect(() => {
    // URL 쿼리스트링에서 필터 읽기
    const categories = searchParams.get('categories')?.split(',');
    const tiers = searchParams.get('tiers')?.split(',');
    // ...
    
    // API 호출
    fetchFilteredPlaces({ categories, tiers, ... });
  }, [searchParams]);
  
  useEffect(() => {
    // 마커 업데이트
    updateMarkers(filteredPlaces);
  }, [filteredPlaces]);
  
  return (
    <div>
      <SearchBar onFilterApply={applyFilter} />
      <div id="map" className="w-full h-screen" />
    </div>
  );
}
```

---

## 5. 구현 체크리스트

### Phase 1: 백엔드 (0.5일)
- [ ] types/index.ts에 SearchQuery, FilterState 인터페이스 추가
- [ ] app/api/search/places/route.ts 생성
  - [ ] Query 파라미터 파싱
  - [ ] Firestore 쿼리 (카테고리)
  - [ ] 클라이언트 필터링 (등급, 키워드, 지역)
  - [ ] 사용자별 필터 (wishOnly, unvisitedOnly)
  - [ ] 정렬 로직
  - [ ] 필터 카운트 계산
- [ ] Firestore 복합 인덱스 생성

### Phase 2: UI 컴포넌트 (1일)
- [ ] components/map/FilterPanel.tsx 생성
  - [ ] 슬라이드 오버 애니메이션
  - [ ] 카테고리 체크박스
  - [ ] 등급 Chip 선택
  - [ ] 지역 Select
  - [ ] 스위치 (미방문/위시리스트)
  - [ ] 정렬 Select
  - [ ] 초기화/적용 버튼
- [ ] SearchBar.tsx에 필터 버튼 추가
  - [ ] 활성화된 필터 카운트 표시
  - [ ] FilterPanel 토글
- [ ] FilterGroup, Checkbox, Switch, Chip 하위 컴포넌트

### Phase 3: 지도 연동 (0.5일)
- [ ] NaverMapView.tsx에 필터 상태 관리
- [ ] 필터 적용 시 마커 업데이트
- [ ] URL 쿼리스트링 동기화
  - [ ] Next.js useRouter로 URL 업데이트
  - [ ] 뒤로 가기 지원
- [ ] 필터 초기화 시 전체 마커 표시

### 테스트
- [ ] 카테고리 필터 동작
- [ ] 등급 필터 동작
- [ ] 복합 필터 (카테고리 + 등급)
- [ ] 사용자별 필터 (미방문, 위시리스트)
- [ ] URL 공유 시 필터 상태 유지
- [ ] 모바일 반응형

---

## 6. 테스트 시나리오

### 시나리오 1: 기본 필터
1. 지도에서 필터 버튼 클릭
2. 카테고리 "한식" 선택
3. 등급 "S", "A" 선택
4. 적용 버튼 클릭
5. ✅ 한식 + S/A등급 장소만 마커 표시
6. ✅ 필터 버튼에 "(2)" 카운트 표시

### 시나리오 2: 미방문 필터
1. 필터 패널 열기
2. "내가 안 가본 곳만" 토글 ON
3. 적용
4. ✅ 내가 리뷰 안 쓴 장소만 표시

### 시나리오 3: URL 공유
1. 필터 적용 (한식 + S등급)
2. URL 복사: `/?categories=한식&tiers=S`
3. 새 탭에서 URL 열기
4. ✅ 같은 필터가 적용된 상태로 로드

### 시나리오 4: 필터 초기화
1. 여러 필터 적용
2. 초기화 버튼 클릭
3. ✅ 모든 필터 해제
4. ✅ 전체 마커 표시

---

## 7. 성능 최적화

### 캐싱 전략
```typescript
// SWR 사용
import useSWR from 'swr';

function useFilteredPlaces(query: SearchQuery) {
  const queryString = new URLSearchParams(query as any).toString();
  const { data, error } = useSWR(
    `/api/search/places?${queryString}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // 30초 캐싱
    }
  );
  
  return { places: data?.places, isLoading: !error && !data, error };
}
```

### 필터 카운트 미리 계산
```typescript
// 초기 로드 시 전체 카운트 계산해서 캐싱
const filterCounts = {
  categories: { 한식: 30, 일식: 25, ... },
  tiers: { S: 10, A: 25, B: 40, ... },
};
```

---

## 8. 향후 확장

### Phase 2 (나중에)
- [ ] 필터 프리셋 저장 ("내가 자주 쓰는 필터")
- [ ] 거리 기반 필터 (현재 위치에서 1km 이내)
- [ ] 가격대 필터 (저렴/보통/비쌈)
- [ ] 영업시간 필터 (지금 영업 중)
- [ ] 태그 필터 (분위기좋아요, 맛있어요 등)

---

## 참고 문서
- FEATURE_IDEAS.md Phase 1.2
- CHECKLIST.md N섹션
- REF_DESIGN_SYSTEM.md (Chip, Switch 디자인)
