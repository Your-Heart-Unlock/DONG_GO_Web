import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/lib/firebase/admin';
import { RatingTier, CategoryKey } from '@/types';
import { getMonthKeyFromDate } from '@/lib/utils/monthKey';
import { calculateRecordPoints } from '@/lib/utils/recordPoints';

/**
 * Admin: Backfill Monthly User Stats
 * POST /api/admin/backfill-aggregates
 *
 * 기존 리뷰 데이터를 스캔하여 monthly_user_stats를 생성합니다.
 * 1회성 마이그레이션용.
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Owner 권한 확인
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Owner role required' },
        { status: 403 }
      );
    }

    // 모든 리뷰 스캔
    const reviewsSnapshot = await adminDb.collection('reviews').get();

    // monthKey -> uid -> aggregated stats
    const monthStats = new Map<string, Map<string, {
      reviews: number;
      recordPoints: number;
      tierCounts: Record<RatingTier, number>;
      categoryReviews: Partial<Record<CategoryKey, number>>;
      lastActiveAt: Date;
    }>>();

    // 장소별 categoryKey 캐시
    const placeCategoryCache = new Map<string, CategoryKey | undefined>();

    let processedReviews = 0;
    let skippedReviews = 0;

    for (const doc of reviewsSnapshot.docs) {
      const data = doc.data();

      // createdAt 필수
      if (!data.createdAt) {
        skippedReviews++;
        continue;
      }

      const createdAt = data.createdAt.toDate();
      const monthKey = getMonthKeyFromDate(createdAt);
      const uid = data.uid;
      const tier = data.ratingTier as RatingTier;
      const placeId = data.placeId;

      // 장소의 categoryKey 조회 (캐시)
      let categoryKey = placeCategoryCache.get(placeId);
      if (categoryKey === undefined && !placeCategoryCache.has(placeId)) {
        try {
          const placeDoc = await adminDb.collection('places').doc(placeId).get();
          categoryKey = placeDoc.exists ? placeDoc.data()?.categoryKey : undefined;
        } catch {
          categoryKey = undefined;
        }
        placeCategoryCache.set(placeId, categoryKey);
      }

      // recordPoints 계산
      const recordPoints = calculateRecordPoints({
        visitedAt: data.visitedAt?.toDate?.(),
        oneLineReview: data.oneLineReview,
        revisitIntent: data.revisitIntent,
        companions: data.companions,
      });

      // 월별 맵 초기화
      if (!monthStats.has(monthKey)) {
        monthStats.set(monthKey, new Map());
      }
      const userStatsMap = monthStats.get(monthKey)!;

      // 사용자별 통계 초기화 또는 업데이트
      if (!userStatsMap.has(uid)) {
        userStatsMap.set(uid, {
          reviews: 0,
          recordPoints: 0,
          tierCounts: { S: 0, A: 0, B: 0, C: 0, F: 0 },
          categoryReviews: {},
          lastActiveAt: createdAt,
        });
      }

      const userStats = userStatsMap.get(uid)!;
      userStats.reviews += 1;
      userStats.recordPoints += recordPoints;
      userStats.tierCounts[tier] = (userStats.tierCounts[tier] || 0) + 1;

      if (categoryKey) {
        userStats.categoryReviews[categoryKey] = (userStats.categoryReviews[categoryKey] || 0) + 1;
      }

      if (createdAt > userStats.lastActiveAt) {
        userStats.lastActiveAt = createdAt;
      }

      processedReviews++;
    }

    // Firestore에 batch write
    let totalWrites = 0;
    const monthKeys: string[] = [];

    for (const [monthKey, userStatsMap] of monthStats.entries()) {
      monthKeys.push(monthKey);

      // 500개 제한에 맞춰 batch 분할
      const entries = Array.from(userStatsMap.entries());
      const batchSize = 500;

      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = adminDb.batch();
        const chunk = entries.slice(i, i + batchSize);

        for (const [uid, stats] of chunk) {
          const statsRef = adminDb
            .collection('monthly_user_stats')
            .doc(monthKey)
            .collection('users')
            .doc(uid);

          batch.set(statsRef, {
            month: monthKey,
            uid,
            reviews: stats.reviews,
            recordPoints: stats.recordPoints,
            tierCounts: stats.tierCounts,
            categoryReviews: stats.categoryReviews,
            lastActiveAt: stats.lastActiveAt,
          });

          totalWrites++;
        }

        await batch.commit();
      }
    }

    // Admin log 기록
    await adminDb.collection('admin_logs').add({
      action: 'BACKFILL_AGGREGATES',
      performedBy: decodedToken.uid,
      metadata: {
        processedReviews,
        skippedReviews,
        totalWrites,
        monthKeys,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      processedReviews,
      skippedReviews,
      totalWrites,
      monthKeys,
    });
  } catch (error) {
    console.error('Backfill aggregates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
