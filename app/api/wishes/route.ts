import { NextRequest, NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/verifyAuth';

/**
 * POST /api/wishes
 * 위시 추가 (member/owner만)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireMember(req);
    if (!auth.success) return auth.response;
    const db = auth.db;

    const body = await req.json();
    const { placeId, note } = body;

    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId is required' },
        { status: 400 }
      );
    }

    // 중복 체크 (이미 위시한 장소인지)
    const existingWishSnap = await db
      .collection('wishes')
      .where('placeId', '==', placeId)
      .where('uid', '==', auth.uid)
      .limit(1)
      .get();

    if (!existingWishSnap.empty) {
      return NextResponse.json(
        { error: 'Already in wishlist' },
        { status: 409 }
      );
    }

    // 위시 생성
    const wishDoc = await db.collection('wishes').add({
      placeId,
      uid: auth.uid,
      note: note || null,
      createdAt: new Date(),
    });

    // PlaceStats의 wishCount 업데이트
    const statsRef = db.collection('stats').doc(placeId);
    const statsSnap = await statsRef.get();

    if (statsSnap.exists) {
      const currentWishCount = statsSnap.data()?.wishCount || 0;
      await statsRef.update({
        wishCount: currentWishCount + 1,
      });
    } else {
      // stats 문서가 없으면 생성
      await statsRef.set({
        reviewCount: 0,
        tierCounts: { S: 0, A: 0, B: 0, C: 0, F: 0 },
        topTags: [],
        reviewerUids: [],
        wishCount: 1,
      });
    }

    return NextResponse.json({
      wishId: wishDoc.id,
      placeId,
      uid: auth.uid,
      note: note || null,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Wish creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create wish' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/wishes?uid={uid}&placeId={placeId}
 * 위시리스트 조회
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireMember(req);
    if (!auth.success) return auth.response;
    const db = auth.db;

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const placeId = searchParams.get('placeId');

    let query: FirebaseFirestore.Query = db.collection('wishes');

    if (uid) {
      query = query.where('uid', '==', uid);
    }

    if (placeId) {
      query = query.where('placeId', '==', placeId);
    }

    const snapshot = await query.get();

    const wishes = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        wishId: doc.id,
        placeId: data.placeId,
        uid: data.uid,
        note: data.note || null,
        createdAt: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ wishes });
  } catch (error) {
    console.error('Wishes fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wishes' },
      { status: 500 }
    );
  }
}
