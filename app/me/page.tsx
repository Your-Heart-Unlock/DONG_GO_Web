'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';
import { RatingTier } from '@/types';

interface RecentReview {
  reviewId: string;
  placeId: string;
  placeName: string;
  ratingTier: RatingTier;
  oneLineReview: string | null;
  createdAt: string;
}

interface CategoryStat {
  categoryKey: string;
  label: string;
  reviewCount: number;
  averageTier: RatingTier | null;
}

interface UserStats {
  totalReviews: number;
  visitedPlaces: number;
  wishlistCount: number;
  tierCounts: Record<RatingTier, number>;
  averageTier: RatingTier | null;
  topTags: { tag: string; count: number }[];
  revisitStats: { yes: number; no: number; unknown: number };
  categoryStats: CategoryStat[];
  recentReviews: RecentReview[];
}

const TIER_COLORS: Record<RatingTier, string> = {
  S: 'bg-red-500',
  A: 'bg-orange-400',
  B: 'bg-yellow-400',
  C: 'bg-green-400',
  F: 'bg-gray-400',
};

const TIER_TEXT_COLORS: Record<RatingTier, string> = {
  S: 'text-red-600',
  A: 'text-orange-500',
  B: 'text-yellow-600',
  C: 'text-green-600',
  F: 'text-gray-500',
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // 리뷰 더보기
  const [reviews, setReviews] = useState<RecentReview[]>([]);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user || (user.role !== 'member' && user.role !== 'owner')) {
      router.push('/');
      return;
    }

    fetchStats();
  }, [user, authLoading, router]);

  async function fetchStats() {
    if (!auth?.currentUser) return;

    setLoading(true);
    setError('');

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/me/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('통계를 불러오지 못했습니다.');
      }

      const data: UserStats = await response.json();
      setStats(data);
      setReviews(data.recentReviews);
      setHasMoreReviews(data.totalReviews > 5);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  }

  async function loadMoreReviews() {
    if (!auth?.currentUser || loadingMore) return;

    setLoadingMore(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(
        `/api/me/reviews?offset=${reviews.length}&limit=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error('리뷰를 불러오지 못했습니다.');

      const data = await response.json();
      setReviews((prev) => [...prev, ...data.reviews]);
      setHasMoreReviews(data.hasMore);
    } catch (err) {
      console.error('Load more reviews error:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return { label: '관리자', className: 'bg-purple-100 text-purple-700' };
      case 'member':
        return { label: '멤버', className: 'bg-green-100 text-green-700' };
      default:
        return { label: role, className: 'bg-gray-100 text-gray-700' };
    }
  };

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
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
            <Link href="/" className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">내 프로필</h1>
          </div>
        </header>
        <div className="max-w-3xl mx-auto p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  if (!stats || !user) return null;

  const roleBadge = getRoleBadge(user.role);
  const totalTierReviews = Object.values(stats.tierCounts).reduce((a, b) => a + b, 0);
  const revisitTotal = stats.revisitStats.yes + stats.revisitStats.no;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">내 프로필</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {/* 유저 정보 카드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{user.nickname}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge.className}`}>
                  {roleBadge.label}
                </span>
              </div>
              {user.createdAt && (
                <p className="text-sm text-gray-500 mt-1">
                  가입일: {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 요약 통계 그리드 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.totalReviews}</p>
            <p className="text-xs text-gray-500 mt-1">리뷰</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.visitedPlaces}</p>
            <p className="text-xs text-gray-500 mt-1">방문 장소</p>
          </div>
          <Link
            href="/me/wishlist"
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 text-center hover:border-blue-300 hover:shadow-md transition-all"
          >
            <p className="text-2xl font-bold text-blue-600">{stats.wishlistCount}</p>
            <p className="text-xs text-gray-500 mt-1">위시리스트 &rarr;</p>
          </Link>
        </div>

        {/* 등급 분포 */}
        {totalTierReviews > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">등급 분포</h3>
              {stats.averageTier && (
                <span className={`text-sm font-bold ${TIER_TEXT_COLORS[stats.averageTier]}`}>
                  평균 {stats.averageTier}
                </span>
              )}
            </div>
            <div className="space-y-2.5">
              {(['S', 'A', 'B', 'C', 'F'] as RatingTier[]).map((tier) => {
                const count = stats.tierCounts[tier];
                const pct = totalTierReviews > 0 ? (count / totalTierReviews) * 100 : 0;
                return (
                  <div key={tier} className="flex items-center gap-3">
                    <span className={`w-5 text-sm font-bold ${TIER_TEXT_COLORS[tier]}`}>{tier}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${TIER_COLORS[tier]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm text-gray-600">
                      {count}개 ({Math.round(pct)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 카테고리 분석 */}
        {stats.categoryStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">카테고리별 분석</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {stats.categoryStats.map((cat) => (
                <div
                  key={cat.categoryKey}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{cat.label}</p>
                    <p className="text-xs text-gray-500">{cat.reviewCount}개 리뷰</p>
                  </div>
                  {cat.averageTier && (
                    <span className={`text-sm font-bold ml-2 ${TIER_TEXT_COLORS[cat.averageTier]}`}>
                      {cat.averageTier}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 자주 쓰는 태그 */}
        {stats.topTags.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">자주 쓰는 태그</h3>
            <div className="flex flex-wrap gap-2">
              {stats.topTags.map(({ tag, count }) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm"
                >
                  {tag}
                  <span className="text-blue-400 text-xs">({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 재방문 의향 */}
        {revisitTotal > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">재방문 의향</h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden flex">
                <div
                  className="bg-green-400 h-full transition-all duration-500"
                  style={{ width: `${(stats.revisitStats.yes / revisitTotal) * 100}%` }}
                />
                <div
                  className="bg-red-300 h-full transition-all duration-500"
                  style={{ width: `${(stats.revisitStats.no / revisitTotal) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-600">
              <span>재방문 {stats.revisitStats.yes}개 ({Math.round((stats.revisitStats.yes / revisitTotal) * 100)}%)</span>
              <span>비재방문 {stats.revisitStats.no}개 ({Math.round((stats.revisitStats.no / revisitTotal) * 100)}%)</span>
            </div>
          </div>
        )}

        {/* 최근 리뷰 */}
        {reviews.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">최근 리뷰</h3>
            <div className="space-y-3">
              {reviews.map((review) => (
                <Link
                  key={review.reviewId}
                  href={`/places/${review.placeId}`}
                  className="block bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${TIER_TEXT_COLORS[review.ratingTier]}`}>
                          {review.ratingTier}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {review.placeName}
                        </span>
                      </div>
                      {review.oneLineReview && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                          {review.oneLineReview}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            {hasMoreReviews && (
              <button
                onClick={loadMoreReviews}
                disabled={loadingMore}
                className="mt-4 w-full py-2.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? '불러오는 중...' : '더보기'}
              </button>
            )}
          </div>
        )}

        {/* 리뷰가 하나도 없을 때 */}
        {stats.totalReviews === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              아직 작성한 리뷰가 없습니다
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              장소를 방문하고 첫 리뷰를 남겨보세요!
            </p>
            <Link
              href="/"
              className="inline-block px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              지도로 이동
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
