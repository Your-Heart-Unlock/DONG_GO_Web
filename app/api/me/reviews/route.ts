import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/me/reviews?offset=0&limit=5
 * 로그인 사용자의 리뷰 목록 (페이지네이션)
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

    const { searchParams } = new URL(req.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    // limit+1개 조회해서 hasMore 판별
    const reviewsSnap = await adminDb
      .collection('reviews')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .offset(offset)
      .limit(limit + 1)
      .get();

    const hasMore = reviewsSnap.size > limit;
    const docs = hasMore ? reviewsSnap.docs.slice(0, limit) : reviewsSnap.docs;

    // place name 조회
    const placeIds = [...new Set(docs.map((d) => d.data().placeId as string))];
    const placeNames = new Map<string, string>();

    const BATCH_SIZE = 30;
    for (let i = 0; i < placeIds.length; i += BATCH_SIZE) {
      const batch = placeIds.slice(i, i + BATCH_SIZE);
      const placeDocs = await Promise.all(
        batch.map((id) => adminDb!.collection('places').doc(id).get())
      );
      placeDocs.forEach((pDoc) => {
        if (pDoc.exists) {
          placeNames.set(pDoc.id, pDoc.data()?.name || '알 수 없음');
        }
      });
    }

    const reviews = docs.map((doc) => {
      const data = doc.data();
      return {
        reviewId: doc.id,
        placeId: data.placeId,
        placeName: placeNames.get(data.placeId) || '알 수 없음',
        ratingTier: data.ratingTier,
        oneLineReview: data.oneLineReview || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ reviews, hasMore });
  } catch (error) {
    console.error('Failed to fetch user reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
