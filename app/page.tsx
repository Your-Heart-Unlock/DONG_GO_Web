'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/firebase/auth';
import { getPlacesByCellIds } from '@/lib/firebase/places';
import NaverMapView, { MapBounds } from '@/components/map/NaverMapView';
import PlaceBottomSheet from '@/components/map/PlaceBottomSheet';
import SearchBar from '@/components/map/SearchBar';
import { getCellIdsForBounds } from '@/lib/utils/cellId';
import { Place, FilterState } from '@/types';

export default function HomePage() {
  const { firebaseUser, user, loading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    isActive: false,
    activeCount: 0,
  });
  const [currentBounds, setCurrentBounds] = useState<MapBounds | null>(null);

  // 클라이언트 캐시: 이미 로드된 placeId는 재요청하지 않음
  const loadedPlaceIdsRef = useRef<Set<string>>(new Set());
  // 이미 쿼리한 cellId 추적
  const loadedCellIdsRef = useRef<Set<string>>(new Set());

  // Bounds 기반 장소 로딩 함수 (재사용 가능)
  const loadPlacesByBounds = useCallback(async (bounds: MapBounds) => {
    const cellIds = getCellIdsForBounds(bounds);

    // cellIds가 null이면 줌이 너무 낮아서 쿼리 불가
    if (!cellIds) return;

    // 이미 로드된 셀 제외
    const newCellIds = cellIds.filter((id) => !loadedCellIdsRef.current.has(id));
    if (newCellIds.length === 0) return;

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
      }
    } catch (error) {
      console.error('장소 로딩 실패:', error);
    } finally {
      setLoadingPlaces(false);
    }
  }, []);

  const handleBoundsChange = useCallback(async (bounds: MapBounds) => {
    // 현재 bounds 저장
    setCurrentBounds(bounds);

    // 필터가 활성화된 상태면 bounds 기반 로딩 스킵
    if (filterState.isActive) return;

    await loadPlacesByBounds(bounds);
  }, [filterState.isActive, loadPlacesByBounds]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  const handleSearch = (query: string) => {
    // TODO: 네이버 지도 검색 API 연동 (나중에 구현)
    console.log('Search query:', query);
    alert('검색 기능은 추후 구현 예정입니다.');
  };

  const handleFilterChange = useCallback(async (newFilterState: FilterState) => {
    setFilterState(newFilterState);

    // 필터가 활성화되지 않은 경우 초기화 후 현재 bounds 재로드
    if (!newFilterState.isActive) {
      // 캐시와 장소 목록 초기화
      loadedPlaceIdsRef.current.clear();
      loadedCellIdsRef.current.clear();
      setPlaces([]);

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
          onSearch={handleSearch}
          placeholder="맛집 검색..."
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <NaverMapView
          places={places}
          onMarkerClick={setSelectedPlace}
          onBoundsChange={handleBoundsChange}
        />
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
