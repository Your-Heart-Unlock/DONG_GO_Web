'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createPlace } from '@/lib/firebase/places';
import { getPlaceById } from '@/lib/firebase/places';

interface SearchResult {
  placeId: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  telephone?: string;
  link?: string;
}

interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export default function AddPlacePage() {
  const router = useRouter();
  const { firebaseUser, user, loading: authLoading } = useAuth();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const isMemberOrOwner = user?.role === 'member' || user?.role === 'owner';

  // 검색 실행
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim() || query.trim().length < 2) {
      setError('검색어는 2글자 이상 입력해주세요.');
      return;
    }

    setSearching(true);
    setError('');
    setResults([]);

    try {
      const response = await fetch(`/api/search/places?query=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '검색에 실패했습니다.');
      }

      setResults(data.places);

      if (data.places.length === 0) {
        setError('검색 결과가 없습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  };

  // 장소 추가
  const handleAddPlace = async (place: SearchResult) => {
    if (!firebaseUser || !isMemberOrOwner) {
      alert('장소를 추가할 권한이 없습니다.');
      return;
    }

    setAdding(place.placeId);

    try {
      // 이미 존재하는지 확인
      const existing = await getPlaceById(place.placeId);

      if (existing) {
        // 이미 존재하면 상세 페이지로 이동
        const goToDetail = confirm(
          `"${place.name}"은(는) 이미 등록된 장소입니다.\n상세 페이지로 이동할까요?`
        );
        if (goToDetail) {
          router.push(`/places/${place.placeId}`);
        }
        return;
      }

      // 신규 생성
      await createPlace({
        placeId: place.placeId,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        category: place.category,
        source: 'user_added',
        status: 'active',
        createdBy: firebaseUser.uid,
      });

      alert(`"${place.name}"이(가) 추가되었습니다.`);
      router.push(`/places/${place.placeId}`);
    } catch (err) {
      console.error('Failed to add place:', err);
      alert(err instanceof Error ? err.message : '장소 추가에 실패했습니다.');
    } finally {
      setAdding(null);
    }
  };

  // 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  // 권한 없음
  if (!isMemberOrOwner) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <svg className="w-16 h-16 text-yellow-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">권한이 필요합니다</h2>
          <p className="text-gray-600 mb-4">
            장소 추가는 승인된 멤버만 가능합니다.
          </p>
          {user?.role === 'pending' && (
            <p className="text-sm text-yellow-600 mb-4">
              현재 승인 대기 중입니다.
            </p>
          )}
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">장소 추가</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {/* 검색 폼 */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="장소명 또는 주소 검색..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={searching}
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {searching ? '검색 중...' : '검색'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            네이버 지도에서 장소를 검색하여 추가합니다.
          </p>
        </form>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 검색 결과 */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-700">
              검색 결과 ({results.length}개)
            </h2>
            <div className="space-y-2">
              {results.map((place) => (
                <div
                  key={place.placeId}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {place.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 truncate">
                        {place.address}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                          {place.category}
                        </span>
                        {place.telephone && (
                          <span className="text-xs text-gray-500">
                            {place.telephone}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddPlace(place)}
                      disabled={adding === place.placeId}
                      className="flex-shrink-0 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {adding === place.placeId ? '추가 중...' : '추가'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 안내 */}
        {results.length === 0 && !error && !searching && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <svg className="w-12 h-12 text-blue-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-blue-800 font-medium">장소를 검색해주세요</p>
            <p className="text-sm text-blue-600 mt-1">
              가게명, 주소 등으로 검색할 수 있습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
