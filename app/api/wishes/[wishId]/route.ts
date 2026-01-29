import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * DELETE /api/wishes/[wishId]
 * 위시 삭제 (본인만)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ wishId: string }> }
) {
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

    const { wishId } = await params;

    // 위시 정보 조회
    const wishSnap = await adminDb.collection('wishes').doc(wishId).get();

    if (!wishSnap.exists) {
      return NextResponse.json(
        { error: 'Wish not found' },
        { status: 404 }
      );
    }

    const wishData = wishSnap.data()!;

    // 권한 체크: 본인만 삭제 가능
    if (wishData.uid !== decodedToken.uid) {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own wishes' },
        { status: 403 }
      );
    }

    const placeId = wishData.placeId;

    // 위시 삭제
    await adminDb.collection('wishes').doc(wishId).delete();

    // PlaceStats의 wishCount 업데이트
    const statsRef = adminDb.collection('stats').doc(placeId);
    const statsSnap = await statsRef.get();

    if (statsSnap.exists) {
      const currentWishCount = statsSnap.data()?.wishCount || 0;
      await statsRef.update({
        wishCount: Math.max(0, currentWishCount - 1),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wish delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete wish' },
      { status: 500 }
    );
  }
}
