import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/lib/firebase/admin';
import {
  MonthlyUserStats,
  LeaderboardEntry,
  CategoryWinner,
  CategoryKey,
} from '@/types';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: CategoryKey[] = [
  'Korea', 'China', 'Japan', 'West',
  'Asian', 'Snack', 'Meat', 'Sea',
  'Cafe', 'Beer', 'Other',
];

/**
 * POST /api/admin/generate-leaderboard
 * Body: { month: "2026-01" }
 *
 * 특정 월의 monthly_user_stats를 기반으로 리더보드 생성
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
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
      return NextResponse.json({ error: 'Forbidden: Owner role required' }, { status: 403 });
    }

    const body = await request.json();
    const { month } = body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }

    // 1. monthly_user_stats 수집
    const userStatsSnapshot = await adminDb
      .collection('monthly_user_stats')
      .doc(month)
      .collection('users')
      .get();

    if (userStatsSnapshot.empty) {
      return NextResponse.json({
        error: `No user stats found for ${month}`,
        suggestion: 'Run backfill-aggregates first to generate user stats',
      }, { status: 404 });
    }

    const userStatsMap = new Map<string, MonthlyUserStats>();
    const uidToNickname = new Map<string, string>();

    for (const doc of userStatsSnapshot.docs) {
      const data = doc.data();
      userStatsMap.set(doc.id, {
        month: data.month || month,
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
    const leaderboard = {
      month,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewKingTop,
      recordKingTop,
      overallTop,
      categoryWinners,
      hiddenCount: 0,
    };

    await adminDb
      .collection('monthly_leaderboard')
      .doc(month)
      .set(leaderboard);

    return NextResponse.json({
      success: true,
      month,
      stats: {
        totalUsers: statsArray.length,
        reviewKingCount: reviewKingTop.length,
        recordKingCount: recordKingTop.length,
        overallCount: overallTop.length,
        categoryWinnerCount: Object.keys(categoryWinners).length,
      },
      preview: {
        top3Overall: overallTop.slice(0, 3),
        categoryWinners: Object.entries(categoryWinners).map(([cat, winner]) => ({
          category: cat,
          nickname: winner.nickname,
          reviews: winner.reviews,
        })),
      },
    });
  } catch (error) {
    console.error('[POST /api/admin/generate-leaderboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate leaderboard' },
      { status: 500 }
    );
  }
}
