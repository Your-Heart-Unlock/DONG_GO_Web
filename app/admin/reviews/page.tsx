'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';

interface ReviewItem {
  reviewId: string;
  placeId: string;
  placeName: string;
  placeAddress: string;
  uid: string;
  nickname: string;
  ratingTier: string;
  oneLineReview: string;
  tags: string[];
  visitedAt: string | null;
  createdAt: string;
}

export default function AdminReviewsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const fetchReviews = async (newOffset: number = 0) => {
    if (!auth?.currentUser) return;

    setLoading(true);
    setError('');

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/admin/reviews?limit=${limit}&offset=${newOffset}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '리뷰 목록을 불러오지 못했습니다.');
      }

      const data = await response.json();
      if (newOffset === 0) {
        setReviews(data.reviews);
      } else {
        setReviews((prev) => [...prev, ...data.reviews]);
      }
      setHasMore(data.hasMore);
      setTotal(data.total);
      setOffset(newOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.role !== 'owner') {
      router.push('/');
      return;
    }

    if (!authLoading && user?.role === 'owner') {
      fetchReviews();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router]);

  const getTierInfo = (tier: string) => {
    const tiers: Record<string, { label: string; color: string; bgColor: string }> = {
      S: { label: 'S', color: 'text-white', bgColor: 'bg-purple-500' },
      A: { label: 'A', color: 'text-white', bgColor: 'bg-blue-500' },
      B: { label: 'B', color: 'text-white', bgColor: 'bg-green-500' },
      C: { label: 'C', color: 'text-white', bgColor: 'bg-yellow-500' },
      F: { label: 'F', color: 'text-white', bgColor: 'bg-gray-500' },
    };
    return tiers[tier] || { label: '?', color: 'text-gray-600', bgColor: 'bg-gray-200' };
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">리뷰 관리</h1>
          <p className="mt-2 text-gray-600">
            전체 리뷰 목록을 확인합니다. (총 {total}개)
          </p>
        </div>
        <Link
          href="/admin"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          대시보드로
        </Link>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* 리뷰 통계 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          총 <strong>{reviews.length}</strong>개의 리뷰가 로드되었습니다.
          {hasMore && ' (더 많은 리뷰가 있습니다)'}
        </p>
      </div>

      {/* 리뷰 목록 */}
      {loading && reviews.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
          로딩 중...
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
          등록된 리뷰가 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    장소
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작성자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    평점
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    한줄평
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작성일
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reviews.map((review) => {
                  const tierInfo = getTierInfo(review.ratingTier);
                  return (
                    <tr key={review.reviewId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {review.placeName}
                        </div>
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          {review.placeAddress || '주소 없음'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {review.nickname}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 text-sm font-bold rounded-full ${tierInfo.bgColor} ${tierInfo.color}`}
                        >
                          {tierInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700 max-w-md truncate">
                          {review.oneLineReview || '-'}
                        </div>
                        {review.tags && review.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {review.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                              >
                                #{tag}
                              </span>
                            ))}
                            {review.tags.length > 3 && (
                              <span className="text-xs text-gray-400">
                                +{review.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(review.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 더 보기 버튼 */}
          {hasMore && (
            <div className="p-4 border-t border-gray-200 text-center">
              <button
                onClick={() => fetchReviews(offset + limit)}
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
              >
                {loading ? '로딩 중...' : '더 보기'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 등급 안내 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium mb-2">등급 안내</p>
        <div className="flex gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold flex items-center justify-center">S</span>
            전파각
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">A</span>
            맛집
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center">B</span>
            괜찮음
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center">C</span>
            보통
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-6 h-6 rounded-full bg-gray-500 text-white text-xs font-bold flex items-center justify-center">F</span>
            별로
          </span>
        </div>
      </div>
    </div>
  );
}
