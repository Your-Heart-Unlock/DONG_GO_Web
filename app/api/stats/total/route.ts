import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

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
  topReviewedPlaces: Array<{
    placeId: string;
    placeName: string;
    reviewCount: number;
  }>;
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

    reviewsSnapshot.forEach((doc) => {
      const data = doc.data();

      // 등급 카운트
      if (data.ratingTier && tierCounts.hasOwnProperty(data.ratingTier)) {
        tierCounts[data.ratingTier]++;
      }

      // 카테고리 카운트
      if (data.categoryKey) {
        categoryCounts[data.categoryKey] = (categoryCounts[data.categoryKey] || 0) + 1;
      }
    });

    // 3. 전체 사용자 수 (member + owner)
    const usersSnapshot = await adminDb
      .collection('users')
      .where('role', 'in', ['member', 'owner'])
      .get();
    const totalUsers = usersSnapshot.size;

    // 4. 인기 장소 Top 10 (리뷰 수 기준)
    const placeReviewCounts: Map<string, { name: string; count: number }> = new Map();

    placesSnapshot.forEach((doc) => {
      const data = doc.data();
      placeReviewCounts.set(doc.id, {
        name: data.name || '이름 없음',
        count: data.reviewCount || 0,
      });
    });

    const topReviewedPlaces = Array.from(placeReviewCounts.entries())
      .map(([placeId, { name, count }]) => ({
        placeId,
        placeName: name,
        reviewCount: count,
      }))
      .sort((a, b) => b.reviewCount - a.reviewCount)
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
      topReviewedPlaces,
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
