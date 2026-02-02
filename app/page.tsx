'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/firebase/auth';
import { getPlacesByCellIds } from '@/lib/firebase/places';
import NaverMapView, { MapBounds } from '@/components/map/NaverMapView';
import PlaceBottomSheet from '@/components/map/PlaceBottomSheet';
import SearchBar, { SearchResultItem } from '@/components/map/SearchBar';
import { getCellIdsForBounds } from '@/lib/utils/cellId';
import { Place, FilterState } from '@/types';

const MAP_STATE_STORAGE_KEY = 'donggo_map_state';
const CLUSTER_MAX_ZOOM = 14; // 이 줌 이하에서는 클러스터링 표시

export default function HomePage() {
  const router = useRouter();
  const { firebaseUser, user, loading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]); // 클러스터링용 전체 장소
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    isActive: false,
    activeCount: 0,
  });
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(12);

  // 지도 상태 (줌, 중심 좌표)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 37.5665, lng: 126.978 });
  const [mapZoom, setMapZoom] = useState<number>(12);

  // 검색 상태
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>();
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState<number>();
  const pendingSelectRef = useRef<string | null>(null);

  // 클라이언트 캐시: 이미 로드된 placeId는 재요청하지 않음
  const loadedPlaceIdsRef = useRef<Set<string>>(new Set());
  // 이미 쿼리한 cellId 추적
  const loadedCellIdsRef = useRef<Set<string>>(new Set());
  // 초기 로딩이 완료되었는지 추적
  const hasInitialLoadedRef = useRef(false);
  // 전체 장소 로드 완료 여부
  const allPlacesLoadedRef = useRef(false);
  // 지도 컴포넌트 재마운트를 위한 key
  const [mapKey, setMapKey] = useState(0);

  // 페이지 로드 시 저장된 지도 상태 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedState = sessionStorage.getItem(MAP_STATE_STORAGE_KEY);
    if (savedState) {
      try {
        const { center, zoom } = JSON.parse(savedState);
        if (center?.lat && center?.lng && zoom) {
          console.log('[HomePage] 지도 상태 복원:', { center, zoom });
          setMapCenter(center);
          setMapZoom(zoom);
          // 복원 시에는 초기 로딩 플래그를 리셋하여 데이터 재로딩 강제
          hasInitialLoadedRef.current = false;
          // 지도 컴포넌트를 강제로 재마운트하여 초기화 로직 실행
          setMapKey(prev => prev + 1);
        }
      } catch (error) {
        console.error('지도 상태 복원 실패:', error);
      }
    }
  }, []);

  // 클러스터링용 전체 장소 로드
  const loadAllPlaces = useCallback(async () => {
    if (allPlacesLoadedRef.current) {
      console.log('[HomePage] 전체 장소 이미 로드됨, 스킵');
      return;
    }

    console.log('[HomePage] 클러스터링용 전체 장소 로딩 시작');
    try {
      const response = await fetch('/api/places/all');
      if (response.ok) {
        const data = await response.json();
        setAllPlaces(data.places);
        allPlacesLoadedRef.current = true;
        console.log(`[HomePage] 전체 장소 로드 완료: ${data.places.length}개`);
      }
    } catch (error) {
      console.error('[HomePage] 전체 장소 로딩 실패:', error);
    }
  }, []);

  // Bounds 기반 장소 로딩 함수 (재사용 가능)
  const loadPlacesByBounds = useCallback(async (bounds: MapBounds) => {
    const cellIds = getCellIdsForBounds(bounds);

    // cellIds가 null이면 줌이 너무 낮아서 쿼리 불가
    if (!cellIds) {
      console.log('[HomePage] 줌 레벨 너무 낮음, 마커 표시 안 함');
      return;
    }

    // 이미 로드된 셀 제외
    const newCellIds = cellIds.filter((id) => !loadedCellIdsRef.current.has(id));
    if (newCellIds.length === 0) {
      console.log('[HomePage] 모든 셀 이미 로드됨, 스킵');
      return;
    }

    console.log(`[HomePage] 새로운 셀 ${newCellIds.length}개 로딩 시작`);
    setLoadingPlaces(true);

    try {
      const newPlaces = await getPlacesByCellIds(newCellIds);

      // 로드된 셀 기록
      newCellIds.forEach((id) => loadedCellIdsRef.current.add(id));

      // 중복 제거 후 추가
      const uniqueNewPlaces = newPlaces.filter(
        (p) => !loadedPlaceIdsRef.current.has(p.placeId)
      );

      if (uniqueNewPlaces.length > 0) {
        uniqueNewPlaces.forEach((p) => loadedPlaceIdsRef.current.add(p.placeId));
        setPlaces((prev) => [...prev, ...uniqueNewPlaces]);
        console.log(`[HomePage] ${uniqueNewPlaces.length}개 장소 추가, 총 ${loadedPlaceIdsRef.current.size}개`);
      } else {
        console.log('[HomePage] 새로운 장소 없음 (중복 제거 후)');
      }
    } catch (error) {
      console.error('[HomePage] 장소 로딩 실패:', error);
    } finally {
      setLoadingPlaces(false);
    }
  }, []);

  const handleBoundsChange = useCallback(async (bounds: MapBounds, zoom: number) => {
    console.log(`[HomePage] handleBoundsChange 호출됨, zoom: ${zoom}, 필터 활성: ${filterState.isActive}, 초기로드완료: ${hasInitialLoadedRef.current}`);

    // 현재 bounds와 zoom 저장
    setCurrentBounds(bounds);
    setCurrentZoom(zoom);

    // 지도 중심 좌표 계산
    const center = {
      lat: (bounds.sw.lat + bounds.ne.lat) / 2,
      lng: (bounds.sw.lng + bounds.ne.lng) / 2,
    };

    // 지도 상태를 sessionStorage에 저장
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          MAP_STATE_STORAGE_KEY,
          JSON.stringify({ center, zoom })
        );
      } catch (error) {
        console.error('지도 상태 저장 실패:', error);
      }
    }

    // 필터가 활성화된 상태면 bounds 기반 로딩 스킵
    if (filterState.isActive) {
      console.log('[HomePage] 필터 활성화 상태, bounds 로딩 스킵');
      return;
    }

    // 클러스터링 모드 (줌 14 이하)에서는 전체 장소 로드
    if (zoom <= CLUSTER_MAX_ZOOM) {
      await loadAllPlaces();
    }

    // 초기 로딩이 아직 안 된 경우 강제로 데이터 로드
    if (!hasInitialLoadedRef.current) {
      console.log('[HomePage] 초기 로딩 강제 실행');
      hasInitialLoadedRef.current = true;
      // 캐시 초기화하여 확실하게 데이터 로드
      loadedCellIdsRef.current.clear();
      loadedPlaceIdsRef.current.clear();
    }

    await loadPlacesByBounds(bounds);
  }, [filterState.isActive, loadPlacesByBounds, loadAllPlaces]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  // 검색 키워드 변경 → API 호출
  const handleQueryChange = useCallback(async (query: string) => {
    setSearchLoading(true);
    try {
      const response = await fetch(
        `/api/places/search?keyword=${encodeURIComponent(query)}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.places);
        setSearchTotal(data.total);
      }
    } catch (error) {
      console.error('[HomePage] Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // 검색 결과 클릭 → 지도 이동 + 바텀시트 표시
  const handleResultClick = useCallback((result: SearchResultItem) => {
    setMapCenter({ lat: result.lat, lng: result.lng });
    setMapZoom(16);

    const existingPlace = places.find((p) => p.placeId === result.placeId);
    if (existingPlace) {
      setSelectedPlace(existingPlace);
    } else {
      pendingSelectRef.current = result.placeId;
    }
  }, [places]);

  // 검색 결과 없을 때 "식당 추가 검색하기" 클릭
  const handleAddSearchClick = useCallback((query: string) => {
    router.push(`/add?q=${encodeURIComponent(query)}`);
  }, [router]);

  // 검색 결과 클릭 후 places가 로드되면 바텀시트 자동 표시
  useEffect(() => {
    if (pendingSelectRef.current) {
      const place = places.find((p) => p.placeId === pendingSelectRef.current);
      if (place) {
        setSelectedPlace(place);
        pendingSelectRef.current = null;
      }
    }
  }, [places]);

  const handleFilterChange = useCallback(async (newFilterState: FilterState) => {
    setFilterState(newFilterState);

    // 필터가 활성화되지 않은 경우 초기화 후 현재 bounds 재로드
    if (!newFilterState.isActive) {
      // 캐시와 장소 목록 초기화
      loadedPlaceIdsRef.current.clear();
      loadedCellIdsRef.current.clear();
      setPlaces([]);
      hasInitialLoadedRef.current = false;

      // 현재 bounds가 있으면 즉시 재로드
      if (currentBounds) {
        console.log('[HomePage] Filter disabled, reloading current bounds');
        await loadPlacesByBounds(currentBounds);
      }
      return;
    }

    // 필터 적용 전 기존 장소 제거 및 로딩 시작 (마커도 함께 제거됨)
    setPlaces([]);
    loadedPlaceIdsRef.current.clear();
    loadedCellIdsRef.current.clear();
    setLoadingPlaces(true);

    try {
      const queryParams = new URLSearchParams();

      if (newFilterState.categories?.length) {
        queryParams.set('categories', newFilterState.categories.join(','));
      }
      if (newFilterState.tiers?.length) {
        queryParams.set('tiers', newFilterState.tiers.join(','));
      }
      if (newFilterState.regions?.length) {
        queryParams.set('regions', newFilterState.regions.join(','));
      }
      if (newFilterState.minReviews) {
        queryParams.set('minReviews', newFilterState.minReviews.toString());
      }
      if (newFilterState.wishOnly) {
        queryParams.set('wishOnly', 'true');
      }
      if (newFilterState.unvisitedOnly) {
        queryParams.set('unvisitedOnly', 'true');
      }
      if (newFilterState.sortBy) {
        queryParams.set('sortBy', newFilterState.sortBy);
      }
      if (newFilterState.sortOrder) {
        queryParams.set('sortOrder', newFilterState.sortOrder);
      }
      if (user?.uid) {
        queryParams.set('uid', user.uid);
      }

      const url = `/api/places/filter?${queryParams.toString()}`;
      console.log('[HomePage] Filter API URL:', url);

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[HomePage] Filter API error:', errorData);
        throw new Error('필터링 실패');
      }

      const data = await response.json();
      console.log('[HomePage] Filter API response:', {
        totalCount: data.stats?.totalCount,
        filteredCount: data.stats?.filteredCount,
        placesLength: data.places?.length,
      });

      setPlaces(data.places || []);

      // 필터 모드에서는 캐시 무효화
      loadedPlaceIdsRef.current.clear();
      loadedCellIdsRef.current.clear();
    } catch (error) {
      console.error('필터링 오류:', error);
      alert('필터링 중 오류가 발생했습니다.');
    } finally {
      setLoadingPlaces(false);
    }
  }, [user?.uid, currentBounds, loadPlacesByBounds]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <main className="relative h-screen w-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">훈동이 맛집</h1>
          {firebaseUser && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-gray-600">{user?.nickname}</span>
              {user?.role === 'pending' && (
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                  승인대기
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === 'member' || user?.role === 'owner') && (
            <Link
              href="/me"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="내 프로필"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </Link>
          )}
          {(user?.role === 'member' || user?.role === 'owner') && (
            <Link
              href="/me/wishlist"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="위시리스트"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </Link>
          )}
          {user?.role === 'owner' && (
            <Link
              href="/admin"
              className="text-sm px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
            >
              관리자
            </Link>
          )}
          {firebaseUser ? (
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              로그아웃
            </button>
          ) : (
            <Link
              href="/login"
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              로그인
            </Link>
          )}
        </div>
      </header>

      {/* Search Bar */}
      <div className="absolute top-20 left-4 right-4 z-20 max-w-md mx-auto">
        <SearchBar
          placeholder="맛집 검색..."
          onFilterChange={handleFilterChange}
          searchResults={searchResults}
          searchLoading={searchLoading}
          searchTotal={searchTotal}
          onResultClick={handleResultClick}
          onAddSearchClick={handleAddSearchClick}
          onQueryChange={handleQueryChange}
        />
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <NaverMapView
          key={mapKey}
          places={places}
          allPlaces={allPlaces}
          onMarkerClick={setSelectedPlace}
          onBoundsChange={handleBoundsChange}
          center={mapCenter}
          zoom={mapZoom}
          isFilterActive={filterState.isActive}
        />

        {/* 필터 로딩 오버레이 */}
        {loadingPlaces && filterState.isActive && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-30">
            <div className="bg-white rounded-xl shadow-lg px-6 py-4 flex items-center gap-3">
              <svg
                className="animate-spin h-5 w-5 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm font-medium text-gray-700">
                필터 적용 중...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <PlaceBottomSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
      />

      {/* Status Info */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md px-3 py-2 text-xs text-gray-600 z-10">
        {loadingPlaces ? '로딩 중...' : (
          <>
            {`${places.length}개 장소 표시 중`}
            {filterState.isActive && (
              <span className="ml-2 text-blue-600 font-semibold">
                (필터 적용됨)
              </span>
            )}
          </>
        )}
      </div>

      {/* 장소 추가 버튼 (member/owner만) */}
      {(user?.role === 'member' || user?.role === 'owner') && (
        <Link
          href="/add"
          className="absolute bottom-4 right-4 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors z-10"
          aria-label="장소 추가"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Link>
      )}
    </main>
  );
}
