'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getPlaceById } from '@/lib/firebase/places';
import { getPlaceStats } from '@/lib/firebase/reviews';
import { Place, PlaceStats, RatingTier } from '@/types';
import ReviewList from '@/components/reviews/ReviewList';

interface PlaceDetailPageProps {
  params: Promise<{ placeId: string }>;
}

export default function PlaceDetailPage({ params }: PlaceDetailPageProps) {
  const { placeId } = use(params);
  const { user, loading: authLoading } = useAuth();
  const [place, setPlace] = useState<Place | null>(null);
  const [stats, setStats] = useState<PlaceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isMemberOrOwner = user?.role === 'member' || user?.role === 'owner';

  useEffect(() => {
    async function fetchPlace() {
      setLoading(true);
      try {
        const [data, statsData] = await Promise.all([
          getPlaceById(placeId),
          getPlaceStats(placeId),
        ]);
        if (!data) {
          setError('장소를 찾을 수 없습니다.');
        } else {
          setPlace(data);
          setStats(statsData);
        }
      } catch (err) {
        setError('장소를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchPlace();
  }, [placeId]);

  // 가장 많은 티어 계산
  function getTopTier(tierCounts: PlaceStats['tierCounts']): RatingTier | '-' {
    const entries = Object.entries(tierCounts) as [RatingTier, number][];
    const max = entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0]);
    return max[1] > 0 ? max[0] : '-';
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-red-600 mb-4">{error || '장소를 찾을 수 없습니다.'}</p>
        <Link
          href="/"
          className="text-blue-600 hover:underline"
        >
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const naverMapUrl = `https://map.naver.com/p/entry/place/${place.placeId}`;

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
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {place.name}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">
        {/* 기본 정보 카드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">{place.name}</h2>
                <p className="mt-1 text-sm text-gray-500">{place.category}</p>
              </div>
              <a
                href={naverMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
              >
                네이버 지도
              </a>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-start gap-2 text-gray-600">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm">{place.address}</span>
              </div>
            </div>
          </div>

          {/* 통계 섹션 (모든 사용자에게 표시) */}
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">통계</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.reviewCount ?? '-'}</p>
                <p className="text-xs text-gray-500">리뷰</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats ? getTopTier(stats.tierCounts) : '-'}
                </p>
                <p className="text-xs text-gray-500">최다 등급</p>
              </div>
            </div>
          </div>
        </div>

        {/* member/owner 전용 섹션 */}
        {isMemberOrOwner ? (
          <>
            {/* 리뷰 섹션 */}
            <ReviewList placeId={placeId} />

            {/* 사진 갤러리 섹션 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">사진</h3>
                <button
                  disabled
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg opacity-50 cursor-not-allowed"
                >
                  사진 추가
                </button>
              </div>
              <div className="text-center py-8 text-gray-500">
                <p>아직 사진이 없습니다.</p>
                <p className="text-sm mt-1">사진 기능은 추후 구현 예정입니다.</p>
              </div>
            </div>
          </>
        ) : (
          /* pending/guest 잠금 안내 */
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-800">
                  멤버 전용 콘텐츠
                </h3>
                <p className="mt-1 text-sm text-yellow-700">
                  리뷰, 사진은 승인된 멤버만 볼 수 있습니다.
                </p>
                {user?.role === 'pending' && (
                  <p className="mt-2 text-sm text-yellow-600">
                    현재 승인 대기 중입니다. 관리자 승인 후 이용할 수 있습니다.
                  </p>
                )}
                {!user && (
                  <Link
                    href="/login"
                    className="mt-3 inline-block text-sm font-medium text-yellow-800 underline hover:no-underline"
                  >
                    로그인하기
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 메타 정보 */}
        <div className="text-xs text-gray-400 space-y-1">
          <p>장소 ID: {place.placeId}</p>
          <p>등록일: {place.createdAt.toLocaleDateString('ko-KR')}</p>
          <p>출처: {place.source === 'naver_import' ? '네이버 지도 Import' : '직접 추가'}</p>
        </div>
      </main>
    </div>
  );
}
