import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/admin/reviews
 * 관리자 전체 리뷰 목록 조회 (owner만)
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

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 리뷰 조회 (최신순)
    const reviewsSnapshot = await adminDb
      .collection('reviews')
      .orderBy('createdAt', 'desc')
      .limit(limit + offset + 1) // hasMore 체크용
      .get();

    const allReviews = reviewsSnapshot.docs.slice(offset, offset + limit + 1);
    const hasMore = allReviews.length > limit;
    const reviews = allReviews.slice(0, limit);

    // 장소 ID와 사용자 ID 수집
    const placeIds = [...new Set(reviews.map((doc) => doc.data().placeId))];
    const userIds = [...new Set(reviews.map((doc) => doc.data().uid))];

    // 장소 정보 조회
    const placesMap: Record<string, { name: string; address: string }> = {};
    if (placeIds.length > 0) {
      const placesSnapshot = await adminDb
        .collection('places')
        .where('__name__', 'in', placeIds.slice(0, 30)) // Firestore in 쿼리 제한
        .get();

      placesSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        placesMap[doc.id] = {
          name: data.name || '알 수 없음',
          address: data.address || '',
        };
      });
    }

    // 사용자 닉네임 조회
    const usersMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const usersSnapshot = await adminDb
        .collection('users')
        .where('__name__', 'in', userIds.slice(0, 30))
        .get();

      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        usersMap[doc.id] = data.nickname || '익명';
      });
    }

    // 리뷰 데이터 변환
    const reviewsData = reviews.map((doc) => {
      const data = doc.data();
      return {
        reviewId: doc.id,
        placeId: data.placeId,
        placeName: placesMap[data.placeId]?.name || '알 수 없음',
        placeAddress: placesMap[data.placeId]?.address || '',
        uid: data.uid,
        nickname: usersMap[data.uid] || data.nickname || '익명',
        ratingTier: data.ratingTier,
        oneLineReview: data.oneLineReview || '',
        tags: data.tags || [],
        visitedAt: data.visitedAt?.toDate?.()?.toISOString() || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      reviews: reviewsData,
      hasMore,
      total: reviewsSnapshot.size,
    });
  } catch (error) {
    console.error('Failed to fetch admin reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
