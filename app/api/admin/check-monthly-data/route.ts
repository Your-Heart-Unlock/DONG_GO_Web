import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/check-monthly-data?month=2026-01
 * 특정 월의 데이터 존재 여부 확인
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month) {
      // 모든 월 데이터 목록 반환
      const leaderboardDocs = await adminDb.collection('monthly_leaderboard').listDocuments();
      const userStatsDocs = await adminDb.collection('monthly_user_stats').listDocuments();

      return NextResponse.json({
        leaderboardMonths: leaderboardDocs.map(doc => doc.id),
        userStatsMonths: userStatsDocs.map(doc => doc.id),
      });
    }

    // 특정 월 데이터 확인
    const leaderboardDoc = await adminDb.collection('monthly_leaderboard').doc(month).get();
    const userStatsCollection = await adminDb
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
