import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/verifyAuth';

/**
 * GET /api/admin/stats
 * 관리자 대시보드 통계 조회 (owner만)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

    // 통계 조회
    const [placesSnapshot, reviewsSnapshot, pendingUsersSnapshot, openRequestsSnapshot] = await Promise.all([
      // 전체 장소 (status가 deleted가 아닌 것들)
      db.collection('places').where('status', '!=', 'deleted').get(),
      // 전체 리뷰
      db.collection('reviews').get(),
      // Pending 사용자
      db.collection('users').where('role', '==', 'pending').get(),
      // 열린 요청
      db.collection('requests').where('status', '==', 'open').get(),
    ]);

    return NextResponse.json({
      totalPlaces: placesSnapshot.size,
      totalReviews: reviewsSnapshot.size,
      pendingUsers: pendingUsersSnapshot.size,
      openRequests: openRequestsSnapshot.size,
    });
  } catch (error) {
    console.error('Failed to fetch admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
