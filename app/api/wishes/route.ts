import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/wishes
 * 위시 추가 (member/owner만)
 */
export async function POST(req: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // 인증 확인
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // 권한 확인
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || !['member', 'owner'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Member or Owner role required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { placeId, note } = body;

    if (!placeId) {
      return NextResponse.json(
        { error: 'placeId is required' },
        { status: 400 }
      );
    }

    // 중복 체크 (이미 위시한 장소인지)
    const existingWishSnap = await adminDb
      .collection('wishes')
      .where('placeId', '==', placeId)
      .where('uid', '==', decodedToken.uid)
      .limit(1)
      .get();

    if (!existingWishSnap.empty) {
      return NextResponse.json(
        { error: 'Already in wishlist' },
        { status: 409 }
      );
    }

    // 위시 생성
    const wishDoc = await adminDb.collection('wishes').add({
      placeId,
      uid: decodedToken.uid,
      note: note || null,
      createdAt: new Date(),
    });

    // PlaceStats의 wishCount 업데이트
    const statsRef = adminDb.collection('stats').doc(placeId);
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
      uid: decodedToken.uid,
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
 * - uid가 있으면: 해당 사용자의 위시리스트
 * - placeId가 있으면: 해당 장소를 위시한 사용자들
 * - 둘 다 있으면: 해당 사용자가 해당 장소를 위시했는지 확인
 */
export async function GET(req: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // 인증 확인
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // 권한 확인
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || !['member', 'owner'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Member or Owner role required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const placeId = searchParams.get('placeId');

    let query = adminDb.collection('wishes');

    if (uid) {
      query = query.where('uid', '==', uid) as any;
    }

    if (placeId) {
      query = query.where('placeId', '==', placeId) as any;
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
