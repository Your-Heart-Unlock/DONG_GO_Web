'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';

interface PhotoWithPlace {
  photoId: string;
  placeId: string;
  url: string;
  placeName: string;
  uploadedBy: string;
  createdAt: string;
}

export default function PhotosPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [photos, setPhotos] = useState<PhotoWithPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const isMemberOrOwner = user?.role === 'member' || user?.role === 'owner';

  useEffect(() => {
    if (authLoading) return;

    if (!isMemberOrOwner) {
      router.push('/');
      return;
    }

    fetchPhotos();
  }, [user, authLoading, router, isMemberOrOwner]);

  async function fetchPhotos() {
    if (!auth?.currentUser) return;

    setLoading(true);
    setError('');

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/photos?limit=50', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      const data = await response.json();
      setPhotos(data.photos || []);
      setHasMore(data.hasMore || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMorePhotos() {
    if (!auth?.currentUser || loadingMore) return;

    setLoadingMore(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/photos?limit=50&offset=${photos.length}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Failed to load more photos');
      }

      const data = await response.json();
      setPhotos([...photos, ...(data.photos || [])]);
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error('Load more photos error:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            <Link href="/" className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">사진</h1>
          </div>
        </header>
        <div className="max-w-7xl mx-auto p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">사진</h1>
          <div className="ml-auto text-sm text-gray-500">
            총 {photos.length}장
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4">
        {photos.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              아직 사진이 없습니다
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              장소를 방문하고 사진을 업로드해보세요!
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
            {/* 사진 그리드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {photos.map((photo) => (
                <Link
                  key={photo.photoId}
                  href={`/places/${photo.placeId}`}
                  className="group relative aspect-square bg-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <img
                    src={photo.url}
                    alt={photo.placeName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-sm font-medium truncate">
                        {photo.placeName}
                      </p>
                      <p className="text-white/80 text-xs">
                        {new Date(photo.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* 더보기 버튼 */}
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={loadMorePhotos}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-white text-gray-700 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingMore ? '로딩 중...' : '더보기'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
