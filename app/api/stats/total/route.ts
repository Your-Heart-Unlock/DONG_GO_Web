import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

// 등급을 점수로 변환 (S=5, A=4, B=3, C=2, F=1)
const TIER_TO_SCORE: Record<string, number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  F: 1,
};

// 최소 리뷰 수 기준 (m)
const MIN_REVIEWS_THRESHOLD = 3;

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
  generatedAt: Date;
}

export async function GET() {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    // 1. 전체 장소 수
    const placesSnapshot = await adminDb.collection('places').get();
    const totalPlaces = placesSnapshot.size;

    // 2. 전체 리뷰 수 및 등급/카테고리 분포
    const reviewsSnapshot = await adminDb.collection('reviews').get();
    const totalReviews = reviewsSnapshot.size;

    const tierCounts: Record<string, number> = { S: 0, A: 0, B: 0, C: 0, F: 0 };
    const categoryCounts: Record<string, number> = {};

    // 장소별 categoryKey 맵 생성
    const placeCategoryMap: Map<string, string> = new Map();
    placesSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.categoryKey) {
        placeCategoryMap.set(doc.id, data.categoryKey);
      }
    });

    // 식당별 리뷰 점수 합산
    const placeScores: Map<string, { totalScore: number; count: number }> = new Map();

    reviewsSnapshot.forEach((doc) => {
      const data = doc.data();

      // 등급 카운트
      if (data.ratingTier && tierCounts.hasOwnProperty(data.ratingTier)) {
        tierCounts[data.ratingTier]++;

        // 식당별 점수 합산
        if (data.placeId) {
          const score = TIER_TO_SCORE[data.ratingTier] || 0;
          const existing = placeScores.get(data.placeId) || { totalScore: 0, count: 0 };
          placeScores.set(data.placeId, {
            totalScore: existing.totalScore + score,
            count: existing.count + 1,
          });

          // 카테고리 카운트 (장소의 categoryKey 사용)
          const categoryKey = placeCategoryMap.get(data.placeId);
          if (categoryKey) {
            categoryCounts[categoryKey] = (categoryCounts[categoryKey] || 0) + 1;
          }
        }
      }
    });

    // 3. 전체 사용자 수 (member + owner)
    const usersSnapshot = await adminDb
      .collection('users')
      .where('role', 'in', ['member', 'owner'])
      .get();
    const totalUsers = usersSnapshot.size;

    // 4. 전체 평균 점수 (C) 계산
    let totalScoreSum = 0;
    let totalScoreCount = 0;
    placeScores.forEach(({ totalScore, count }) => {
      totalScoreSum += totalScore;
      totalScoreCount += count;
    });
    const globalAvgScore = totalScoreCount > 0 ? totalScoreSum / totalScoreCount : 3; // 기본값 3 (B등급)

    // 5. 가중 평균 점수로 Top 10 계산
    // 공식: 점수 = (v/(v+m)) × R + (m/(v+m)) × C
    // v = 리뷰 수, m = 최소 리뷰 기준, R = 식당 평균, C = 전체 평균
    const m = MIN_REVIEWS_THRESHOLD;
    const C = globalAvgScore;

    const placeData: Map<string, { name: string; avgTier: string }> = new Map();
    placesSnapshot.forEach((doc) => {
      const data = doc.data();
      placeData.set(doc.id, {
        name: data.name || '이름 없음',
        avgTier: data.avgTier || '-',
      });
    });

    const topPlaces: TopPlace[] = Array.from(placeScores.entries())
      .map(([placeId, { totalScore, count }]) => {
        const v = count; // 리뷰 수
        const R = totalScore / count; // 식당 평균 점수

        // 가중 평균 공식 적용
        const weightedScore = (v / (v + m)) * R + (m / (v + m)) * C;

        const place = placeData.get(placeId);
        return {
          placeId,
          placeName: place?.name || '이름 없음',
          reviewCount: v,
          avgScore: Math.round(R * 100) / 100,
          weightedScore: Math.round(weightedScore * 100) / 100,
          avgTier: place?.avgTier || '-',
        };
      })
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 10);

    const stats: TotalStats = {
      totals: {
        totalPlaces,
        totalReviews,
        totalUsers,
      },
      distributions: {
        tierCounts,
        categoryCounts,
      },
      topPlaces,
      rankingInfo: {
        formula: '(v/(v+m)) × R + (m/(v+m)) × C',
        minReviews: m,
        globalAvgScore: Math.round(C * 100) / 100,
      },
      generatedAt: new Date(),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[GET /api/stats/total] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch total stats' },
      { status: 500 }
    );
  }
}
