'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createPlace, getPlaceById, findNearbyPlaces, updatePlace } from '@/lib/firebase/places';
import { CategoryKey } from '@/types';
import { CATEGORY_LABELS, ALL_CATEGORY_KEYS } from '@/lib/utils/categoryIcon';

// 사용자가 선택 가능한 카테고리 (Idle 제외)
const SELECTABLE_CATEGORIES = ALL_CATEGORY_KEYS.filter((key) => key !== 'Idle');

/**
 * 이름 유사도 체크 (간단한 정규화 후 비교)
 */
function isSimilarName(name1: string, name2: string): boolean {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/\s+/g, '') // 공백 제거
      .replace(/[^\w가-힣]/g, ''); // 특수문자 제거

  const n1 = normalize(name1);
  const n2 = normalize(name2);

  // 정확히 일치하거나 한쪽이 다른쪽을 포함하면 유사하다고 판단
  return n1 === n2 || n1.includes(n2) || n2.includes(n1);
}

interface SearchResult {
  placeId: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  telephone?: string;
  link?: string;
  source?: 'kakao' | 'naver';
}

interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

type SearchProvider = 'kakao' | 'naver';

function AddPlaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { firebaseUser, user, loading: authLoading } = useAuth();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [searchProvider, setSearchProvider] = useState<SearchProvider>('kakao');
  const [kakaoNoResults, setKakaoNoResults] = useState(false);

  // 카테고리 선택 모달 상태
  const [pendingPlace, setPendingPlace] = useState<SearchResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);

  const isMemberOrOwner = user?.role === 'member' || user?.role === 'owner';

  // 검색 실행 (공통 로직)
  const performSearch = useCallback(async (searchQuery: string, provider: SearchProvider = 'kakao') => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setError('검색어는 2글자 이상 입력해주세요.');
      return;
    }

    setSearching(true);
    setError('');
    setResults([]);
    setPagination(null);
    setKakaoNoResults(false);

    try {
      const response = await fetch(
        `/api/search/places?query=${encodeURIComponent(searchQuery)}&page=1&provider=${provider}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '검색에 실패했습니다.');
      }

      setResults(data.places);
      setPagination(data.pagination);

      if (data.places.length === 0) {
        if (provider === 'kakao') {
          setKakaoNoResults(true);
        }
        setError(provider === 'naver'
          ? '네이버 검색 결과가 없습니다. 지역명을 추가하여 다시 검색해보세요.'
          : '카카오 검색 결과가 없습니다.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  }, []);

  // ?q= 파라미터로 자동 검색
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams, performSearch]);

  // 폼 제출
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, searchProvider);
  };

  // 네이버 검색으로 전환
  const handleSwitchToNaver = () => {
    setSearchProvider('naver');
    setKakaoNoResults(false);
    setError('');
    setResults([]);
    setPagination(null);
  };

  // 카카오 검색으로 복귀
  const handleSwitchToKakao = () => {
    setSearchProvider('kakao');
    setKakaoNoResults(false);
    setError('');
    setResults([]);
    setPagination(null);
  };

  // 더 보기
  const handleLoadMore = async () => {
    if (!pagination?.hasMore || loadingMore) return;

    const nextPage = pagination.page + 1;
    setLoadingMore(true);

    try {
      const response = await fetch(
        `/api/search/places?query=${encodeURIComponent(query)}&page=${nextPage}&provider=${searchProvider}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '검색에 실패했습니다.');
      }

      setResults((prev) => [...prev, ...data.places]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 결과를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoadingMore(false);
    }
  };

  // 카테고리 선택 모달 열기
  const handleOpenCategoryModal = (place: SearchResult) => {
    if (!firebaseUser || !isMemberOrOwner) {
      alert('장소를 추가할 권한이 없습니다.');
      return;
    }
    setPendingPlace(place);
    setSelectedCategory(null);
  };

  // 크로스 ID resolve (비동기, 실패해도 장소 추가는 진행)
  async function resolveCrossIds(place: SearchResult, provider: SearchProvider): Promise<{
    naverPlaceId?: string;
    kakaoPlaceId?: string;
  }> {
    const crossIds: { naverPlaceId?: string; kakaoPlaceId?: string } = {};

    try {
      if (provider === 'kakao') {
        // 카카오로 추가 → 네이버 ID 매칭
        crossIds.kakaoPlaceId = place.placeId;
        const res = await fetch(
          `/api/search/naver-resolve?name=${encodeURIComponent(place.name)}&lat=${place.lat}&lng=${place.lng}`
        );
        const data = await res.json();
        if (data.naverPlaceId) {
          crossIds.naverPlaceId = data.naverPlaceId;
        }
      } else {
        // 네이버로 추가 → 카카오 ID 매칭
        // naver_ 접두사 제거하여 순수 네이버 ID 저장
        const rawNaverId = place.placeId.replace(/^naver_/, '');
        crossIds.naverPlaceId = rawNaverId;
        const res = await fetch(
          `/api/search/kakao-resolve?name=${encodeURIComponent(place.name)}&lat=${place.lat}&lng=${place.lng}`
        );
        const data = await res.json();
        if (data.kakaoPlaceId) {
          crossIds.kakaoPlaceId = data.kakaoPlaceId;
        }
      }
    } catch (err) {
      console.warn('크로스 ID resolve 실패 (장소 추가는 계속 진행):', err);
    }

    return crossIds;
  }

  // 카테고리 선택 후 장소 추가
  const handleConfirmAdd = async () => {
    if (!pendingPlace || !selectedCategory || !firebaseUser) return;

    const place = pendingPlace;
    setAdding(place.placeId);
    setPendingPlace(null);

    try {
      const finalPlaceId = place.placeId;
      const isNaver = searchProvider === 'naver' || place.source === 'naver';

      // 1. ID 기반 중복 체크
      const existing = await getPlaceById(finalPlaceId);
      if (existing) {
        // 삭제된 장소라면 재활성화 옵션 제공
        if (existing.status === 'deleted') {
          const reactivate = confirm(
            `"${place.name}"은(는) 이전에 삭제된 장소입니다.\n다시 활성화하시겠습니까?`
          );
          if (reactivate) {
            const crossIds = await resolveCrossIds(place, isNaver ? 'naver' : 'kakao');
            await updatePlace(finalPlaceId, {
              name: place.name,
              address: place.address,
              lat: place.lat,
              lng: place.lng,
              category: CATEGORY_LABELS[selectedCategory],
              categoryKey: selectedCategory,
              status: 'active',
              mapProvider: isNaver ? 'naver' : 'kakao',
              ...(crossIds.naverPlaceId && { naverPlaceId: crossIds.naverPlaceId }),
              ...(crossIds.kakaoPlaceId && { kakaoPlaceId: crossIds.kakaoPlaceId }),
            });
            alert(`"${place.name}"이(가) 다시 활성화되었습니다.`);
            router.push(`/places/${finalPlaceId}`);
          }
          return;
        }

        // 활성 상태인 경우 기존 동작
        const goToDetail = confirm(
          `"${place.name}"은(는) 이미 등록된 장소입니다.\n상세 페이지로 이동할까요?`
        );
        if (goToDetail) {
          router.push(`/places/${finalPlaceId}`);
        }
        return;
      }

      // 2. 좌표 기반 중복 체크 (30m 이내 + 이름 유사도)
      const nearbyPlaces = await findNearbyPlaces(place.lat, place.lng);

      // 이름이 유사한 근처 장소만 중복으로 판단
      const similarNearbyPlaces = nearbyPlaces.filter((nearby) =>
        isSimilarName(nearby.name, place.name)
      );

      if (similarNearbyPlaces.length > 0) {
        const nearbyPlace = similarNearbyPlaces[0];
        const goToDetail = confirm(
          `30m 이내에 비슷한 이름의 "${nearbyPlace.name}"이(가) 이미 등록되어 있습니다.\n같은 장소인가요?\n\n확인: 상세 페이지로 이동\n취소: 그래도 추가하기`
        );
        if (goToDetail) {
          router.push(`/places/${nearbyPlace.placeId}`);
          return;
        }
        // 취소를 누르면 계속 진행 (새로 추가)
      }

      // 3. 크로스 ID resolve
      const crossIds = await resolveCrossIds(place, isNaver ? 'naver' : 'kakao');

      // 4. 신규 생성 (선택된 카테고리 사용)
      await createPlace({
        placeId: finalPlaceId,
        name: place.name,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        category: CATEGORY_LABELS[selectedCategory], // 한글 카테고리명
        categoryKey: selectedCategory, // CategoryKey
        source: 'user_added',
        status: 'active',
        mapProvider: isNaver ? 'naver' : 'kakao',
        ...(crossIds.naverPlaceId && { naverPlaceId: crossIds.naverPlaceId }),
        ...(crossIds.kakaoPlaceId && { kakaoPlaceId: crossIds.kakaoPlaceId }),
        createdBy: firebaseUser.uid,
      });

      alert(`"${place.name}"이(가) 추가되었습니다.`);
      router.push(`/places/${finalPlaceId}`);
    } catch (err) {
      console.error('Failed to add place:', err);
      alert(err instanceof Error ? err.message : '장소 추가에 실패했습니다.');
    } finally {
      setAdding(null);
      setSelectedCategory(null);
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
        {/* 검색 모드 표시 */}
        {searchProvider === 'naver' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-green-600 font-bold text-lg flex-shrink-0">N</span>
              <div className="flex-1">
                <p className="text-green-800 font-medium text-sm">네이버 검색 모드</p>
                <p className="text-green-700 text-xs mt-1">
                  네이버 검색은 최대 5개 결과만 제공합니다. 정확한 검색을 위해 식당 이름 뒤에 지역명(예: &apos;맛집이름 강남&apos;)을 추가해주세요.
                </p>
              </div>
              <button
                onClick={handleSwitchToKakao}
                className="flex-shrink-0 text-xs text-green-700 underline hover:text-green-900"
              >
                카카오로 돌아가기
              </button>
            </div>
          </div>
        )}

        {/* 검색 폼 */}
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchProvider === 'naver'
                ? "식당 이름 + 지역명 (예: 맛집이름 강남)"
                : "장소명 또는 주소 검색..."
              }
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={searching}
            />
            <button
              type="submit"
              disabled={searching || !query.trim()}
              className={`px-6 py-3 text-white font-medium rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${
                searchProvider === 'naver'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {searching ? '검색 중...' : '검색'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {searchProvider === 'naver'
              ? '네이버 지도에서 장소를 검색하여 추가합니다.'
              : '카카오 지도에서 장소를 검색하여 추가합니다.'
            }
          </p>
        </form>

        {/* 에러 메시지 */}
        {error && !kakaoNoResults && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 카카오 0건 → 네이버 검색 안내 */}
        {kakaoNoResults && searchProvider === 'kakao' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-5 space-y-3">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-orange-800 font-medium">
                  카카오에서 &quot;{query}&quot;에 대한 결과를 찾지 못했습니다.
                </p>
                <p className="text-orange-700 text-sm mt-1">
                  카카오 지도에 등록되지 않은 장소일 수 있습니다. 네이버에서 검색해보세요.
                </p>
              </div>
            </div>
            <button
              onClick={handleSwitchToNaver}
              className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              네이버에서 검색하기
            </button>
          </div>
        )}

        {/* 검색 결과 */}
        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-700">
              검색 결과 {pagination ? `(${results.length} / ${pagination.total}개)` : `(${results.length}개)`}
              {searchProvider === 'naver' && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                  네이버
                </span>
              )}
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
                        {place.source === 'naver' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                            네이버
                          </span>
                        )}
                        {place.telephone && (
                          <span className="text-xs text-gray-500">
                            {place.telephone}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenCategoryModal(place)}
                      disabled={adding === place.placeId}
                      className="flex-shrink-0 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {adding === place.placeId ? '추가 중...' : '추가'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {pagination?.hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full py-3 text-sm font-medium text-blue-600 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 disabled:text-gray-400 disabled:bg-gray-50 transition-colors"
              >
                {loadingMore ? '불러오는 중...' : '더 보기'}
              </button>
            )}
          </div>
        )}

        {/* 안내 */}
        {results.length === 0 && !error && !searching && !kakaoNoResults && (
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

      {/* 카테고리 선택 모달 */}
      {pendingPlace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">카테고리 선택</h3>
              <p className="text-sm text-gray-600 mt-1">
                &quot;{pendingPlace.name}&quot;의 카테고리를 선택해주세요.
              </p>
            </div>

            <div className="p-4 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-2 gap-2">
                {SELECTABLE_CATEGORIES.map((categoryKey) => (
                  <button
                    key={categoryKey}
                    onClick={() => setSelectedCategory(categoryKey)}
                    className={`p-3 text-left rounded-lg border-2 transition-all ${
                      selectedCategory === categoryKey
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-medium">{CATEGORY_LABELS[categoryKey]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setPendingPlace(null);
                  setSelectedCategory(null);
                }}
                className="flex-1 py-3 text-gray-700 font-medium bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmAdd}
                disabled={!selectedCategory}
                className="flex-1 py-3 text-white font-medium bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddPlacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">로딩 중...</p>
        </div>
      }
    >
      <AddPlaceContent />
    </Suspense>
  );
}
