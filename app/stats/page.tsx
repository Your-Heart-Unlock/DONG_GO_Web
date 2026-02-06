'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RatingTier, CategoryKey } from '@/types';
import { CATEGORY_LABELS } from '@/lib/utils/categoryIcon';

const TIER_COLORS: Record<RatingTier, { bg: string; bar: string }> = {
  S: { bg: 'bg-purple-100', bar: 'bg-purple-500' },
  A: { bg: 'bg-blue-100', bar: 'bg-blue-500' },
  B: { bg: 'bg-green-100', bar: 'bg-green-500' },
  C: { bg: 'bg-orange-100', bar: 'bg-orange-500' },
  F: { bg: 'bg-red-100', bar: 'bg-red-500' },
};

const TIER_LABELS: Record<RatingTier, string> = {
  S: '전파각',
  A: '동네강자',
  B: '평타',
  C: '땜빵',
  F: '지뢰',
};

interface TopPlace {
  placeId: string;
  placeName: string;
  reviewCount: number;
  avgScore: number;
  weightedScore: number;
  avgTier: string;
}

interface TotalStats {
  totals: {
    totalPlaces: number;
    totalReviews: number;
    totalUsers: number;
  };
  distributions: {
    tierCounts: Record<string, number>;
    categoryCounts: Record<string, number>;
  };
  topPlaces: TopPlace[];
  rankingInfo: {
    formula: string;
    minReviews: number;
    globalAvgScore: number;
  };
  generatedAt: string;
}

export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<TotalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFormulaInfo, setShowFormulaInfo] = useState(false);

  const isMemberOrOwner = user?.role === 'member' || user?.role === 'owner';

  useEffect(() => {
    async function fetchStats() {
      if (!isMemberOrOwner) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/stats/total');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          setStats(null);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setStats(null);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchStats();
    }
  }, [isMemberOrOwner, authLoading]);

  // 등급 분포 최댓값 계산 (바 차트용)
  const tierCounts = stats?.distributions.tierCounts || { S: 0, A: 0, B: 0, C: 0, F: 0 };
  const maxTierCount = Math.max(...Object.values(tierCounts), 1);

  // 카테고리 분포
  const categoryCounts = stats?.distributions.categoryCounts || {};
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, 10);
  const maxCategoryCount = Math.max(...sortedCategories.map(([, c]) => c || 0), 1);

  // 권한 없음
  if (!authLoading && !isMemberOrOwner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">멤버 전용 콘텐츠</h2>
          <p className="text-gray-600 mb-4">서비스 통계는 승인된 멤버만 볼 수 있습니다.</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            메인으로 돌아가기
          </Link>
        </div>
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
          <h1 className="text-lg font-bold text-gray-900">전체 통계</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading || authLoading ? (
          <div className="text-center py-12 text-gray-500">
            <p>로딩 중...</p>
          </div>
        ) : !stats ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-600">통계를 불러오지 못했습니다.</p>
            <p className="text-sm text-gray-400 mt-1">잠시 후 다시 시도해주세요.</p>
          </div>
        ) : (
          <>
            {/* Hero Stats */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
              <p className="text-blue-100 text-sm mb-2">Dong-go 전체 통계</p>
              <p className="text-2xl font-bold">
                {stats.totals.totalUsers}명이{' '}
                <span className="text-blue-200">{stats.totals.totalReviews.toLocaleString()}개</span>의 리뷰를 남겼어요
              </p>
              <p className="text-blue-200 text-sm mt-2">
                등록된 장소: {stats.totals.totalPlaces.toLocaleString()}곳
              </p>
            </div>

            {/* 등급 분포 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">등급 분포</h3>
              <div className="space-y-3">
                {(['S', 'A', 'B', 'C', 'F'] as RatingTier[]).map(tier => {
                  const count = tierCounts[tier] || 0;
                  const percentage = maxTierCount > 0 ? (count / maxTierCount) * 100 : 0;

                  return (
                    <div key={tier} className="flex items-center gap-3">
                      <div className={`w-12 h-8 ${TIER_COLORS[tier].bg} rounded flex items-center justify-center`}>
                        <span className="text-sm font-bold">{tier}</span>
                      </div>
                      <div className="flex-1">
                        <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${TIER_COLORS[tier].bar} transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-20 text-right">
                        <span className="text-sm font-medium text-gray-900">{count.toLocaleString()}</span>
                        <span className="text-xs text-gray-500 ml-1">개</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                {(['S', 'A', 'B', 'C', 'F'] as RatingTier[]).map(tier => (
                  <span key={tier} className="text-xs text-gray-500">
                    {tier}: {TIER_LABELS[tier]}
                  </span>
                ))}
              </div>
            </div>

            {/* 카테고리 분포 */}
            {sortedCategories.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">카테고리별 리뷰</h3>
                <div className="space-y-3">
                  {sortedCategories.map(([category, count]) => {
                    const percentage = maxCategoryCount > 0 ? ((count || 0) / maxCategoryCount) * 100 : 0;

                    return (
                      <div key={category} className="flex items-center gap-3">
                        <div className="w-20 text-sm text-gray-600 truncate">
                          {CATEGORY_LABELS[category as CategoryKey] || category}
                        </div>
                        <div className="flex-1">
                          <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-16 text-right">
                          <span className="text-sm font-medium text-gray-900">{count?.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 맛집 Top 10 (가중 평균) */}
            {stats.topPlaces && stats.topPlaces.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">맛집 Top 10</h3>
                  <button
                    type="button"
                    onClick={() => setShowFormulaInfo(!showFormulaInfo)}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    점수 계산 방식
                  </button>
                </div>

                {/* 점수 계산 설명 */}
                {showFormulaInfo && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-sm font-medium text-blue-900 mb-2">가중 평균 점수 (IMDB 방식)</p>
                    <div className="bg-white rounded p-3 mb-3 font-mono text-sm text-center text-blue-800">
                      점수 = (v/(v+m)) × R + (m/(v+m)) × C
                    </div>
                    <ul className="text-xs text-blue-800 space-y-1">
                      <li><strong>v</strong> = 해당 식당의 리뷰 수</li>
                      <li><strong>m</strong> = 최소 리뷰 기준 ({stats.rankingInfo.minReviews}개)</li>
                      <li><strong>R</strong> = 해당 식당의 평균 점수</li>
                      <li><strong>C</strong> = 전체 평균 점수 ({stats.rankingInfo.globalAvgScore}점)</li>
                    </ul>
                    <p className="text-xs text-blue-700 mt-3 pt-2 border-t border-blue-200">
                      리뷰 수가 적은 식당은 전체 평균에 가깝게 보정되어, 소수의 극단적 리뷰가 순위에 과도하게 영향을 주는 것을 방지합니다.
                    </p>
                    <div className="mt-3 pt-2 border-t border-blue-200">
                      <p className="text-xs text-blue-600">등급별 점수: S=5, A=4, B=3, C=2, F=1</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {stats.topPlaces.map((place, index) => (
                    <Link
                      key={place.placeId}
                      href={`/places/${place.placeId}`}
                      className="flex items-center gap-3 p-3 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-600' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {place.placeName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {place.reviewCount}개 리뷰 · 평균 {place.avgTier}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">{place.weightedScore.toFixed(2)}</p>
                        <p className="text-xs text-gray-400">점</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 명예의 전당 바로가기 */}
        <Link
          href="/leaderboard"
          className="block bg-yellow-50 rounded-xl border border-yellow-200 p-4 hover:bg-yellow-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-900">명예의 전당 보기</p>
              <p className="text-xs text-yellow-600 mt-0.5">리뷰왕, 기록왕, 카테고리 챔피언 확인</p>
            </div>
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </main>
    </div>
  );
}
