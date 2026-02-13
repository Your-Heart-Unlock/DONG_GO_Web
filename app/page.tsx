'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import HallOfFamePreview from '@/components/HallOfFamePreview';

const MAP_STATE_STORAGE_KEY = 'donggo_map_state';
const CLUSTER_MAX_ZOOM = 14; // 이 줌 레벨 이하에서 클러스터링 표시

function isPlaceInBounds(place: Place, bounds: MapBounds): boolean {
  return (
    place.lat >= bounds.sw.lat &&
    place.lat <= bounds.ne.lat &&
    place.lng >= bounds.sw.lng &&
    place.lng <= bounds.ne.lng
  );
}

export default function HomePage() {
  const router = useRouter();
  const { firebaseUser, user, loading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    isActive: false,
    activeCount: 0,
  });
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);
  const [currentZoom, setCurrentZoom] = useState<number>(12);

  // 지도 상태 (세션 저장소에서 복원 가능)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 37.5665, lng: 126.978 });
  const [mapZoom, setMapZoom] = useState<number>(12);

  // 검색 결과 상태
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>();
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTotal, setSearchTotal] = useState<number>();
  const pendingSelectRef = useRef<string | null>(null);

  // 이미 로드된 placeId 추적 (중복 방지)
  const loadedPlaceIdsRef = useRef<Set<string>>(new Set());
  // 이미 로드된 cellId 추적
  const loadedCellIdsRef = useRef<Set<string>>(new Set());
  // 초기 로딩 완료 여부 추적
  const hasInitialLoadedRef = useRef(false);
  // 전체 장소 로딩 상태
  const allPlacesLoadedRef = useRef(false);
  const allPlacesLoadingRef = useRef(false);
  const loadingCellIdsRef = useRef<Set<string>>(new Set());
  // 지도 재마운트용 key (필터 초기화 시)
  const [mapKey, setMapKey] = useState(0);
  // 필터 패널 열림 상태
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  // 식당 리스트 접힘 상태
  const [isPlaceListCollapsed, setIsPlaceListCollapsed] = useState(false);

  const highlightedPlaceId = hoveredPlaceId ?? selectedPlace?.placeId ?? null;
  const showVisiblePlacesPanel = currentZoom > CLUSTER_MAX_ZOOM && currentBounds !== null;

  const visiblePlaces = useMemo(() => {
    if (!showVisiblePlacesPanel || !currentBounds) return [];

    return places
      .filter((place) => isPlaceInBounds(place, currentBounds))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [places, currentBounds, showVisiblePlacesPanel]);

  // 세션 저장소에서 지도 상태 복원
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedState = sessionStorage.getItem(MAP_STATE_STORAGE_KEY);
    if (savedState) {
      try {
        const { center, zoom } = JSON.parse(savedState);
        if (center?.lat && center?.lng && zoom) {
          console.log('[HomePage] 지도 상태 복원', { center, zoom });
          setMapCenter(center);
          setMapZoom(zoom);
          // 복원된 상태로 초기 로딩 리셋
          hasInitialLoadedRef.current = false;
          // 지도 key 변경으로 재마운트하여 새 위치 적용
          setMapKey(prev => prev + 1);
        }
      } catch (error) {
        console.error('지도 상태 복원 실패', error);
      }
    }
  }, []);

  // 클러스터링용 전체 장소 로드
  const loadAllPlaces = useCallback(async () => {
    if (allPlacesLoadedRef.current || allPlacesLoadingRef.current) {
      return;
    }

    allPlacesLoadingRef.current = true;
    try {
      const response = await fetch('/api/places/all');
      if (response.ok) {
        const data = await response.json();
        setAllPlaces(data.places);
        allPlacesLoadedRef.current = true;
      }
    } catch (error) {
      console.error('[HomePage] failed to load all places:', error);
    } finally {
      allPlacesLoadingRef.current = false;
    }
  }, []);

  // Bounds 변경 시 장소 로드 (점진적)
  const loadPlacesByBounds = useCallback(async (bounds: MapBounds) => {
    const cellIds = getCellIdsForBounds(bounds);

    if (!cellIds) {
      return;
    }

    const newCellIds = cellIds.filter(
      (id) => !loadedCellIdsRef.current.has(id) && !loadingCellIdsRef.current.has(id)
    );
    if (newCellIds.length === 0) {
      return;
    }

    newCellIds.forEach((id) => loadingCellIdsRef.current.add(id));
    setLoadingPlaces(true);

    try {
      const newPlaces = await getPlacesByCellIds(newCellIds);

      newCellIds.forEach((id) => loadedCellIdsRef.current.add(id));

      const uniqueNewPlaces = newPlaces.filter(
        (p) => !loadedPlaceIdsRef.current.has(p.placeId)
      );

      if (uniqueNewPlaces.length > 0) {
        uniqueNewPlaces.forEach((p) => loadedPlaceIdsRef.current.add(p.placeId));
        setPlaces((prev) => [...prev, ...uniqueNewPlaces]);
      }
    } catch (error) {
      console.error('[HomePage] failed to load places by bounds:', error);
    } finally {
      newCellIds.forEach((id) => loadingCellIdsRef.current.delete(id));
      setLoadingPlaces(false);
    }
  }, []);

  const handleBoundsChange = useCallback(async (bounds: MapBounds, zoom: number) => {
    setCurrentBounds(bounds);
    setCurrentZoom(zoom);

    const center = {
      lat: (bounds.sw.lat + bounds.ne.lat) / 2,
      lng: (bounds.sw.lng + bounds.ne.lng) / 2,
    };

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(
          MAP_STATE_STORAGE_KEY,
          JSON.stringify({ center, zoom })
        );
      } catch (error) {
        console.error('failed to persist map state:', error);
      }
    }

    if (filterState.isActive) {
      return;
    }

    if (zoom <= CLUSTER_MAX_ZOOM) {
      await loadAllPlaces();
    }

    if (!hasInitialLoadedRef.current) {
      hasInitialLoadedRef.current = true;
      loadedCellIdsRef.current.clear();
      loadedPlaceIdsRef.current.clear();
    }

    await loadPlacesByBounds(bounds);
  }, [filterState.isActive, loadPlacesByBounds, loadAllPlaces]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('로그아웃 실패', error);
    }
  };

  // 검색어 변경 시 API 호출
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

  // 검색 결과 클릭 시 지도 이동 + 선택
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

  const handleMarkerClick = useCallback((place: Place) => {
    setSelectedPlace(place);
  }, []);

  const handleVisiblePlaceClick = useCallback((place: Place) => {
    // 현재 줌 레벨 유지하면서 해당 장소로 이동
    setMapCenter({ lat: place.lat, lng: place.lng });
    setSelectedPlace(place);
  }, []);

  // 검색 결과에서 '없으면 추가' 클릭 시
  const handleAddSearchClick = useCallback((query: string) => {
    router.push(`/add?q=${encodeURIComponent(query)}`);
  }, [router]);

  // 검색 결과 클릭 후 places 로드되면 선택
  useEffect(() => {
    if (pendingSelectRef.current) {
      const place = places.find((p) => p.placeId === pendingSelectRef.current);
      if (place) {
        setSelectedPlace(place);
        pendingSelectRef.current = null;
      }
    }
  }, [places]);

  useEffect(() => {
    if (currentZoom <= CLUSTER_MAX_ZOOM && hoveredPlaceId) {
      setHoveredPlaceId(null);
    }
  }, [currentZoom, hoveredPlaceId]);

  const handleFilterChange = useCallback(async (newFilterState: FilterState) => {
    setFilterState(newFilterState);

    // 필터 해제 시 기존 bounds로 다시 로드
    if (!newFilterState.isActive) {
      // 필터 해제: 지도 상태 초기화
      loadedPlaceIdsRef.current.clear();
      loadedCellIdsRef.current.clear();
      setPlaces([]);
      hasInitialLoadedRef.current = false;

      // 현재 bounds로 다시 장소 로드
      if (currentBounds) {
        console.log('[HomePage] Filter disabled, reloading current bounds');
        await loadPlacesByBounds(currentBounds);
      }
      return;
    }

    // 필터 적용: 전체 장소에서 필터링 (지도 bounds 무시)
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
        throw new Error('Filter API failed');
      }

      const data = await response.json();
      console.log('[HomePage] Filter API response:', {
        totalCount: data.stats?.totalCount,
        filteredCount: data.stats?.filteredCount,
        placesLength: data.places?.length,
      });

      setPlaces(data.places || []);

      // 필터 후 지도 상태 캐시 초기화
      loadedPlaceIdsRef.current.clear();
      loadedCellIdsRef.current.clear();
    } catch (error) {
      console.error('필터 적용 실패', error);
      alert('필터 적용에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoadingPlaces(false);
    }
  }, [user?.uid, currentBounds, loadPlacesByBounds]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">로딩 중..</p>
      </div>
    );
  }

  return (
    <main className="relative h-screen w-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Dong-go</h1>
          {firebaseUser && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-gray-600">{user?.nickname}</span>
              {user?.role === 'pending' && (
                <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                  승인 대기
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
              title="Profile"
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
              title="Wishlist"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </Link>
          )}
          {(user?.role === 'member' || user?.role === 'owner') && (
            <Link
              href="/stats"
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="통계"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
          placeholder="장소 검색.."
          onFilterChange={handleFilterChange}
          onFilterPanelOpenChange={setIsFilterPanelOpen}
          searchResults={searchResults}
          searchLoading={searchLoading}
          searchTotal={searchTotal}
          onResultClick={handleResultClick}
          onAddSearchClick={handleAddSearchClick}
          onQueryChange={handleQueryChange}
        />
      </div>

      {/* 명예의 전당 미리보기 (member/owner만) - 맛집 추가 버튼 위에 배치 */}
      {(user?.role === 'member' || user?.role === 'owner') && (
        <div className={`absolute bottom-44 md:bottom-24 right-4 z-20 ${isFilterPanelOpen ? 'pointer-events-none' : ''}`}>
          <div className={`relative ${isFilterPanelOpen ? 'after:absolute after:inset-0 after:bg-black/40 after:rounded-xl after:z-10' : ''}`}>
            <HallOfFamePreview expandDirection="up" />
          </div>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <NaverMapView
          key={mapKey}
          places={places}
          allPlaces={allPlaces}
          onMarkerClick={handleMarkerClick}
          onBoundsChange={handleBoundsChange}
          center={mapCenter}
          zoom={mapZoom}
          isFilterActive={filterState.isActive}
          highlightedPlaceId={highlightedPlaceId}
        />

        {showVisiblePlacesPanel && (
          <aside className={`absolute bottom-24 left-4 z-20 hidden md:block w-80 ${isFilterPanelOpen ? 'pointer-events-none' : ''}`}>
            <div className="relative flex flex-col items-start">
              {/* 리스트 (위로 펼쳐짐) */}
              {!isPlaceListCollapsed && (
                <div className="mb-2 w-full rounded-xl border-2 border-gray-300 bg-white shadow-xl overflow-hidden">
                  {visiblePlaces.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      현재 영역에 표시되는 장소가 없습니다.
                    </div>
                  ) : (
                    <ul className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
                      {visiblePlaces.map((place) => {
                        const isActive = highlightedPlaceId === place.placeId;
                        return (
                          <li key={place.placeId}>
                            <button
                              type="button"
                              onMouseEnter={() => setHoveredPlaceId(place.placeId)}
                              onMouseLeave={() => setHoveredPlaceId(null)}
                              onFocus={() => setHoveredPlaceId(place.placeId)}
                              onBlur={() => setHoveredPlaceId(null)}
                              onClick={() => handleVisiblePlaceClick(place)}
                              className={`w-full text-left px-4 py-3 transition-colors ${
                                isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-sm font-medium truncate ${isActive ? 'text-blue-700' : 'text-gray-900'}`}>
                                  {place.name}
                                </p>
                                {place.avgTier && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                                    {place.avgTier}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-xs text-gray-500 line-clamp-1">{place.address}</p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {isFilterPanelOpen && <div className="absolute inset-0 bg-black/40 rounded-xl z-10" />}
                </div>
              )}
              {/* 하단 헤더 (고정) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsPlaceListCollapsed(!isPlaceListCollapsed)}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border-2 border-gray-300 shadow-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-800">Visible Restaurants</p>
                    <p className="text-xs text-gray-500">{visiblePlaces.length} shown</p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-600 transition-transform ${isPlaceListCollapsed ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                {isFilterPanelOpen && <div className="absolute inset-0 bg-black/40 rounded-xl z-10" />}
              </div>
            </div>
          </aside>
        )}

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
                필터 적용 중..
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sheet */}
      <PlaceBottomSheet
        place={selectedPlace}
        onClose={() => {
          setSelectedPlace(null);
          setHoveredPlaceId(null);
        }}
      />

      {/* Status Info */}
      <div className="absolute bottom-28 md:bottom-4 left-4 bg-white rounded-lg shadow-md px-3 py-2 text-xs text-gray-600 z-10">
        {loadingPlaces ? '로딩 중..' : (
          <>
            {`${places.length} places shown`}
            {filterState.isActive && (
              <span className="ml-2 text-blue-600 font-semibold">
                (필터 적용됨)
              </span>
            )}
          </>
        )}
      </div>

      {/* 맛집 추가 버튼 (member/owner만) */}
      {(user?.role === 'member' || user?.role === 'owner') && (
        <Link
          href="/add"
          className="absolute bottom-28 md:bottom-6 right-4 z-10 group"
          aria-label="맛집 추가"
        >
          <div className="flex items-center gap-2 bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 border border-rose-400/30">
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="font-semibold text-sm">맛집 추가</span>
          </div>
        </Link>
      )}
    </main>
  );
}
