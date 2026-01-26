'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/lib/firebase/auth';
import { getRecentPlaces } from '@/lib/firebase/places';
import NaverMapView from '@/components/map/NaverMapView';
import PlaceBottomSheet from '@/components/map/PlaceBottomSheet';
import SearchBar from '@/components/map/SearchBar';
import { Place } from '@/types';

export default function HomePage() {
  const { firebaseUser, user, loading } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(true);

  // 장소 데이터 로드
  useEffect(() => {
    async function loadPlaces() {
      setLoadingPlaces(true);
      const data = await getRecentPlaces(100);
      setPlaces(data);
      setLoadingPlaces(false);
    }
    loadPlaces();
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

  // 비로그인 사용자 - 로그인 유도
  if (!firebaseUser) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
        <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md">
          <h1 className="text-3xl font-bold text-center text-gray-900">훈동이 맛집 지도</h1>
          <p className="text-center text-gray-600">우리끼리 공유하는 맛집 큐레이션</p>
          <Link
            href="/login"
            className="block w-full text-center rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            로그인하기
          </Link>
        </div>
      </main>
    );
  }

  // 로그인 사용자 - 지도 표시
  return (
    <main className="relative h-screen w-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">훈동이 맛집</h1>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-gray-600">{user?.nickname}</span>
            {user?.role === 'pending' && (
              <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                승인대기
              </span>
            )}
          </div>
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
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="absolute top-20 left-4 right-4 z-20 max-w-md mx-auto">
        <SearchBar onSearch={handleSearch} placeholder="맛집 검색..." />
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loadingPlaces ? (
          <div className="flex h-full items-center justify-center bg-gray-100">
            <p className="text-gray-500">장소 로딩 중...</p>
          </div>
        ) : (
          <>
            <NaverMapView
              places={places}
              onMarkerClick={setSelectedPlace}
            />
            {places.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white rounded-lg shadow-lg p-6 text-center pointer-events-auto">
                  <p className="text-gray-600 font-medium mb-2">등록된 장소가 없습니다</p>
                  <p className="text-sm text-gray-500 mb-3">
                    관리자가 장소를 추가하면 지도에 표시됩니다.
                  </p>
                  {user?.role === 'owner' && (
                    <a
                      href="/admin/import"
                      className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      장소 가져오기
                    </a>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Sheet */}
      <PlaceBottomSheet
        place={selectedPlace}
        onClose={() => setSelectedPlace(null)}
      />

      {/* Status Info (Debug) */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md px-3 py-2 text-xs text-gray-600 z-10">
        {places.length}개 장소 표시 중
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
