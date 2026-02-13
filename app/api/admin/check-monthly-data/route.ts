import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/verifyAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/check-monthly-data?month=2026-01
 * 특정 월의 데이터 존재 여부 확인
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month) {
      // 모든 월 데이터 목록 반환
      const leaderboardDocs = await db.collection('monthly_leaderboard').listDocuments();
      const userStatsDocs = await db.collection('monthly_user_stats').listDocuments();

      return NextResponse.json({
        leaderboardMonths: leaderboardDocs.map(doc => doc.id),
        userStatsMonths: userStatsDocs.map(doc => doc.id),
      });
    }

    // 특정 월 데이터 확인
    const leaderboardDoc = await db.collection('monthly_leaderboard').doc(month).get();
    const userStatsCollection = await db
      .collection('monthly_user_stats')
      .doc(month)
      .collection('users')
      .get();

    return NextResponse.json({
      month,
      leaderboard: {
        exists: leaderboardDoc.exists,
        data: leaderboardDoc.exists ? {
          reviewKingCount: leaderboardDoc.data()?.reviewKingTop?.length || 0,
          recordKingCount: leaderboardDoc.data()?.recordKingTop?.length || 0,
          overallCount: leaderboardDoc.data()?.overallTop?.length || 0,
          categoryWinners: Object.keys(leaderboardDoc.data()?.categoryWinners || {}),
        } : null,
      },
      userStats: {
        exists: !userStatsCollection.empty,
        userCount: userStatsCollection.size,
        users: userStatsCollection.docs.slice(0, 5).map(doc => ({
          uid: doc.id,
          reviews: doc.data().reviews || 0,
          recordPoints: doc.data().recordPoints || 0,
        })),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/check-monthly-data] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check monthly data' },
      { status: 500 }
    );
  }
}
