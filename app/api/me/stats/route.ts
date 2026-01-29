import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { CATEGORY_LABELS, inferCategoryKey } from '@/lib/utils/categoryIcon';
import { RatingTier, CategoryKey } from '@/types';

const TIER_WEIGHTS: Record<RatingTier, number> = { S: 5, A: 4, B: 3, C: 2, F: 1 };

function computeAverageTier(tierCounts: Record<RatingTier, number>, total: number): RatingTier | null {
  if (total === 0) return null;
  const sum = Object.entries(tierCounts).reduce(
    (acc, [tier, count]) => acc + TIER_WEIGHTS[tier as RatingTier] * count,
    0
  );
  const avg = sum / total;
  if (avg >= 4.5) return 'S';
  if (avg >= 3.5) return 'A';
  if (avg >= 2.5) return 'B';
  if (avg >= 1.5) return 'C';
  return 'F';
}

/**
 * GET /api/me/stats
 * 로그인 사용자의 개인 통계 조회
 */
export async function GET(req: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (!userData || !['member', 'owner'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Member or Owner role required' },
        { status: 403 }
      );
    }

    // 1. 리뷰 전체 조회
    const reviewsSnap = await adminDb
      .collection('reviews')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .get();

    // 2. 위시 수 조회
    const wishesSnap = await adminDb
      .collection('wishes')
      .where('uid', '==', uid)
      .get();

    // 리뷰 데이터 집계
    const tierCounts: Record<RatingTier, number> = { S: 0, A: 0, B: 0, C: 0, F: 0 };
    const tagCounts: Record<string, number> = {};
    const revisitStats = { yes: 0, no: 0, unknown: 0 };
    const uniquePlaceIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allReviews: any[] = [];

    reviewsSnap.docs.forEach((doc) => {
      const data = doc.data();
      allReviews.push({ reviewId: doc.id, ...data });

      // 등급 집계
      if (data.ratingTier && tierCounts[data.ratingTier as RatingTier] !== undefined) {
        tierCounts[data.ratingTier as RatingTier]++;
      }

      // 장소 수집
      if (data.placeId) {
        uniquePlaceIds.add(data.placeId);
      }

      // 태그 집계
      if (data.tags && Array.isArray(data.tags)) {
        data.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }

      // 재방문 의향
      if (data.revisitIntent === true) {
        revisitStats.yes++;
      } else if (data.revisitIntent === false) {
        revisitStats.no++;
      } else {
        revisitStats.unknown++;
      }
    });

    const totalReviews = reviewsSnap.size;
    const averageTier = computeAverageTier(tierCounts, totalReviews);

    // 상위 태그 10개
    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // 3. 장소 docs 배치 조회 → 카테고리 분석
    const placeIdArray = Array.from(uniquePlaceIds);
    const placeMap = new Map<string, { name: string; categoryKey: CategoryKey }>();
    const BATCH_SIZE = 30;

    for (let i = 0; i < placeIdArray.length; i += BATCH_SIZE) {
      const batch = placeIdArray.slice(i, i + BATCH_SIZE);
      const placePromises = batch.map((id) =>
        adminDb!.collection('places').doc(id).get()
      );
      const placeDocs = await Promise.all(placePromises);

      placeDocs.forEach((pDoc) => {
        if (pDoc.exists) {
          const pData = pDoc.data()!;
          const categoryKey = pData.categoryKey || inferCategoryKey(pData.category || '');
          placeMap.set(pDoc.id, {
            name: pData.name || '알 수 없음',
            categoryKey,
          });
        }
      });
    }

    // 카테고리별 집계
    const categoryMap = new Map<CategoryKey, { reviewCount: number; tierCounts: Record<RatingTier, number> }>();

    allReviews.forEach((review) => {
      const place = placeMap.get(review.placeId);
      if (!place) return;

      const cat = place.categoryKey;
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { reviewCount: 0, tierCounts: { S: 0, A: 0, B: 0, C: 0, F: 0 } });
      }
      const entry = categoryMap.get(cat)!;
      entry.reviewCount++;
      if (review.ratingTier && entry.tierCounts[review.ratingTier as RatingTier] !== undefined) {
        entry.tierCounts[review.ratingTier as RatingTier]++;
      }
    });

    const categoryStats = Array.from(categoryMap.entries())
      .map(([key, val]) => ({
        categoryKey: key,
        label: CATEGORY_LABELS[key] || key,
        reviewCount: val.reviewCount,
        averageTier: computeAverageTier(val.tierCounts, val.reviewCount),
      }))
      .sort((a, b) => b.reviewCount - a.reviewCount);

    // 최근 리뷰 5개 (placeName 포함)
    const recentReviews = allReviews.slice(0, 5).map((r) => ({
      reviewId: r.reviewId,
      placeId: r.placeId,
      placeName: placeMap.get(r.placeId)?.name || '알 수 없음',
      ratingTier: r.ratingTier,
      oneLineReview: r.oneLineReview || null,
      createdAt: r.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
    }));

    return NextResponse.json({
      totalReviews,
      visitedPlaces: uniquePlaceIds.size,
      wishlistCount: wishesSnap.size,
      tierCounts,
      averageTier,
      topTags,
      revisitStats,
      categoryStats,
      recentReviews,
    });
  } catch (error) {
    console.error('Failed to fetch user stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
