'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';
import { Place, Wish } from '@/types';

export default function WishlistPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [wishes, setWishes] = useState<(Wish & { place?: Place })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user || (user.role !== 'member' && user.role !== 'owner')) {
      router.push('/');
      return;
    }

    fetchWishlist();
  }, [user, authLoading, router]);

  async function fetchWishlist() {
    if (!user || !auth?.currentUser) return;

    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();

      // 내 위시 목록 조회
      const response = await fetch(`/api/wishes?uid=${user.uid}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const wishesData = data.wishes || [];

        // 각 위시의 장소 정보 조회
        const wishesWithPlaces = await Promise.all(
          wishesData.map(async (wish: Wish) => {
            try {
              const placeResponse = await fetch(`/api/places/${wish.placeId}`);
              if (placeResponse.ok) {
                const placeData = await placeResponse.json();
                return { ...wish, place: placeData };
              }
            } catch (error) {
              console.error('Failed to fetch place:', error);
            }
            return wish;
          })
        );

        setWishes(wishesWithPlaces);
      }
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
    } finally {
      setLoading(false);
    }
  }

  async function removeWish(wishId: string) {
    if (!confirm('위시리스트에서 제거하시겠습니까?')) return;

    try {
      if (!auth?.currentUser) return;

      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/wishes/${wishId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setWishes(wishes.filter((w) => w.wishId !== wishId));
      } else {
        alert('위시리스트 제거에 실패했습니다.');
      }
    } catch (error) {
      console.error('Remove wish error:', error);
      alert('위시리스트 제거에 실패했습니다.');
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            내 위시리스트
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {wishes.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              아직 위시리스트가 비어있습니다
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              지도에서 마음에 드는 장소에 💚를 눌러보세요!
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              지도로 이동
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              총 {wishes.length}개의 장소
            </div>
            <div className="space-y-3">
              {wishes.map((wish) => (
                <div
                  key={wish.wishId}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {wish.place ? (
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <Link
                          href={`/places/${wish.placeId}`}
                          className="flex-1 min-w-0"
                        >
                          <h3 className="font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate">
                            {wish.place.name}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                            {wish.place.address}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
                              {wish.place.category}
                            </span>
                            {wish.place.avgTier && (
                              <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                                {wish.place.avgTier}등급
                              </span>
                            )}
                          </div>
                        </Link>
                        <button
                          onClick={() => removeWish(wish.wishId)}
                          className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="위시리스트에서 제거"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                          </svg>
                        </button>
                      </div>
                      {wish.note && (
                        <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
                          메모: {wish.note}
                        </div>
                      )}
                      <div className="mt-3 text-xs text-gray-400">
                        추가일: {new Date(wish.createdAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4">
                      <p className="text-sm text-gray-500">장소 정보를 불러올 수 없습니다.</p>
                      <button
                        onClick={() => removeWish(wish.wishId)}
                        className="mt-2 text-sm text-red-600 hover:underline"
                      >
                        제거하기
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
