import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/admin/stats
 * 관리자 대시보드 통계 조회 (owner만)
 */
export async function GET(request: NextRequest) {
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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

    // 통계 조회
    const [placesSnapshot, reviewsSnapshot, pendingUsersSnapshot, openRequestsSnapshot] = await Promise.all([
      // 전체 장소 (status가 deleted가 아닌 것들)
      adminDb.collection('places').where('status', '!=', 'deleted').get(),
      // 전체 리뷰
      adminDb.collection('reviews').get(),
      // Pending 사용자
      adminDb.collection('users').where('role', '==', 'pending').get(),
      // 열린 요청
      adminDb.collection('requests').where('status', '==', 'open').get(),
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
