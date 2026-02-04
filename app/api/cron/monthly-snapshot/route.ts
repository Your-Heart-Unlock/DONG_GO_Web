import { NextRequest, NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebase/admin';
import {
  MonthlyUserStats,
  MonthlyLeaderboard,
  MonthlyServiceStats,
  LeaderboardEntry,
  CategoryWinner,
  RatingTier,
  CategoryKey,
} from '@/types';
import { getCurrentMonthKey } from '@/lib/utils/monthKey';
import { CATEGORY_LABELS } from '@/lib/utils/categoryIcon';

const VALID_CATEGORIES: CategoryKey[] = [
  'Korea', 'China', 'Japan', 'West',
  'Asian', 'Snack', 'Meat', 'Sea',
  'Cafe', 'Beer', 'Other',
];

/**
 * Cron Job: Daily Monthly Snapshot
 * POST /api/cron/monthly-snapshot
 *
 * Vercel Cron: 매일 18:10 UTC (= 03:10 KST)
 */
export async function POST(request: NextRequest) {
  try {
    // Vercel Cron 인증 또는 CRON_SECRET 인증
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Vercel Cron은 Authorization: Bearer <CRON_SECRET> 헤더를 보냄
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const monthKey = getCurrentMonthKey();

    // 1. monthly_user_stats 수집
    const userStatsSnapshot = await adminDb
      .collection('monthly_user_stats')
      .doc(monthKey)
      .collection('users')
      .get();

    const userStatsMap = new Map<string, MonthlyUserStats>();
    const uidToNickname = new Map<string, string>();

    for (const doc of userStatsSnapshot.docs) {
      const data = doc.data();
      userStatsMap.set(doc.id, {
        month: data.month,
        uid: doc.id,
        reviews: data.reviews || 0,
        recordPoints: data.recordPoints || 0,
        tierCounts: data.tierCounts || { S: 0, A: 0, B: 0, C: 0, F: 0 },
        categoryReviews: data.categoryReviews || {},
        lastActiveAt: data.lastActiveAt?.toDate() || new Date(),
      });
    }

    // 2. 사용자 닉네임 일괄 조회
    const uids = Array.from(userStatsMap.keys());
    for (const uid of uids) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (userDoc.exists) {
          uidToNickname.set(uid, userDoc.data()?.nickname || '익명');
        }
      } catch {
        uidToNickname.set(uid, '익명');
      }
    }

    // 3. 리더보드 계산
    const statsArray = Array.from(userStatsMap.values());

    // 리뷰왕 (reviews 기준)
    const reviewKingTop: LeaderboardEntry[] = statsArray
      .filter(s => s.reviews > 0)
      .sort((a, b) => b.reviews - a.reviews)
      .slice(0, 10)
      .map(s => ({
        uid: s.uid,
        nickname: uidToNickname.get(s.uid) || '익명',
        value: s.reviews,
      }));

    // 기록왕 (recordPoints 기준)
    const recordKingTop: LeaderboardEntry[] = statsArray
      .filter(s => s.recordPoints > 0)
      .sort((a, b) => b.recordPoints - a.recordPoints)
      .slice(0, 10)
      .map(s => ({
        uid: s.uid,
        nickname: uidToNickname.get(s.uid) || '익명',
        value: s.recordPoints,
      }));

    // 종합 (reviews + recordPoints)
    const overallTop: LeaderboardEntry[] = statsArray
      .filter(s => s.reviews > 0 || s.recordPoints > 0)
      .sort((a, b) => (b.reviews + b.recordPoints) - (a.reviews + a.recordPoints))
      .slice(0, 10)
      .map(s => ({
        uid: s.uid,
        nickname: uidToNickname.get(s.uid) || '익명',
        value: s.reviews + s.recordPoints,
      }));

    // 카테고리별 챔피언
    const categoryWinners: Partial<Record<CategoryKey, CategoryWinner>> = {};
    for (const category of VALID_CATEGORIES) {
      const categoryStats = statsArray
        .filter(s => (s.categoryReviews[category] || 0) > 0)
        .sort((a, b) => (b.categoryReviews[category] || 0) - (a.categoryReviews[category] || 0));

      if (categoryStats.length > 0) {
        const winner = categoryStats[0];
        categoryWinners[category] = {
          uid: winner.uid,
          nickname: uidToNickname.get(winner.uid) || '익명',
          reviews: winner.categoryReviews[category] || 0,
        };
      }
    }

    // 4. Leaderboard 저장
    const leaderboard: Omit<MonthlyLeaderboard, 'generatedAt'> & { generatedAt: FirebaseFirestore.FieldValue } = {
      month: monthKey,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewKingTop,
      recordKingTop,
      overallTop,
      categoryWinners,
      hiddenCount: 0, // 비공개 설정 기능 추가 시 구현
    };

    await adminDb
      .collection('monthly_leaderboard')
      .doc(monthKey)
      .set(leaderboard);

    // 5. Service Stats 계산
    // 전체 리뷰 수 및 등급 분포
    const tierCounts: Record<RatingTier, number> = { S: 0, A: 0, B: 0, C: 0, F: 0 };
    let totalReviews = 0;

    for (const stats of statsArray) {
      totalReviews += stats.reviews;
      for (const tier of ['S', 'A', 'B', 'C', 'F'] as RatingTier[]) {
        tierCounts[tier] += stats.tierCounts[tier] || 0;
      }
    }

    // 카테고리 분포
    const categoryCounts: Partial<Record<CategoryKey, number>> = {};
    for (const stats of statsArray) {
      for (const [cat, count] of Object.entries(stats.categoryReviews)) {
        categoryCounts[cat as CategoryKey] = (categoryCounts[cat as CategoryKey] || 0) + (count || 0);
      }
    }

    // 활성 사용자 수
    const activeUsers = statsArray.length;

    // 전체 장소 수
    const placesSnapshot = await adminDb
      .collection('places')
      .where('status', '==', 'active')
      .count()
      .get();
    const totalPlaces = placesSnapshot.data().count;

    // 인기 장소 Top 10 (리뷰 수 기준)
    const statsCollectionSnapshot = await adminDb
      .collection('stats')
      .orderBy('reviewCount', 'desc')
      .limit(10)
      .get();

    const topReviewedPlaces: MonthlyServiceStats['topReviewedPlaces'] = [];
    for (const doc of statsCollectionSnapshot.docs) {
      const placeDoc = await adminDb.collection('places').doc(doc.id).get();
      if (placeDoc.exists) {
        topReviewedPlaces.push({
          placeId: doc.id,
          placeName: placeDoc.data()?.name || '알 수 없음',
          reviewCount: doc.data().reviewCount || 0,
        });
      }
    }

    // 6. Service Stats 저장
    const serviceStats = {
      month: monthKey,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      totals: {
        totalReviews,
        activeUsers,
        totalPlaces,
      },
      distributions: {
        tierCounts,
        categoryCounts,
      },
      topReviewedPlaces,
    };

    await adminDb
      .collection('monthly_service_stats')
      .doc(monthKey)
      .set(serviceStats);

    return NextResponse.json({
      success: true,
      monthKey,
      leaderboard: {
        reviewKingCount: reviewKingTop.length,
        recordKingCount: recordKingTop.length,
        overallCount: overallTop.length,
        categoryWinnerCount: Object.keys(categoryWinners).length,
      },
      serviceStats: {
        totalReviews,
        activeUsers,
        totalPlaces,
      },
    });
  } catch (error) {
    console.error('Monthly snapshot error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET 메서드도 허용 (수동 테스트용)
export async function GET(request: NextRequest) {
  return POST(request);
}
