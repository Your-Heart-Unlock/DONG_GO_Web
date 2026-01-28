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
import { Place } from '@/types';

export default function HomePage() {
  const { firebaseUser, user, loading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

  // 클라이언트 캐시: 이미 로드된 placeId는 재요청하지 않음
  const loadedPlaceIdsRef = useRef<Set<string>>(new Set());
  // 이미 쿼리한 cellId 추적
  const loadedCellIdsRef = useRef<Set<string>>(new Set());

  const handleBoundsChange = useCallback(async (bounds: MapBounds) => {
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
        <SearchBar onSearch={handleSearch} placeholder="맛집 검색..." />
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
        {loadingPlaces ? '로딩 중...' : `${places.length}개 장소 표시 중`}
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
