import { NextRequest, NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/verifyAuth';

/**
 * GET /api/me/reviews?offset=0&limit=5
 * 로그인 사용자의 리뷰 목록 (페이지네이션)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireMember(req);
    if (!auth.success) return auth.response;
    const db = auth.db;
    const uid = auth.uid;

    const { searchParams } = new URL(req.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    // limit+1개 조회해서 hasMore 판별
    const reviewsSnap = await db
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
        batch.map((id) => db.collection('places').doc(id).get())
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
