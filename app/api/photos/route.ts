import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/photos
 * 모든 사진 목록 조회 (member/owner만)
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

    // Member 또는 Owner 권한 확인
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || (userData.role !== 'member' && userData.role !== 'owner')) {
      return NextResponse.json(
        { error: 'Forbidden: Member or Owner role required' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 모든 사진 조회 (최신순)
    const photosSnapshot = await adminDb
      .collection('photos')
      .orderBy('uploadedAt', 'desc')
      .limit(limit + 1) // hasMore 체크를 위해 +1
      .offset(offset)
      .get();

    const hasMore = photosSnapshot.size > limit;
    const photos = photosSnapshot.docs.slice(0, limit).map((doc) => {
      const data = doc.data();
      return {
        photoId: doc.id,
        placeId: data.placeId,
        url: data.url,
        uploadedBy: data.uploadedBy,
        createdAt: data.uploadedAt?.toDate()?.toISOString() || new Date().toISOString(),
      };
    });

    // 각 사진의 장소 정보 추가
    const photosWithPlace = await Promise.all(
      photos.map(async (photo) => {
        try {
          const placeDoc = await adminDb!.collection('places').doc(photo.placeId).get();
          const placeData = placeDoc.data();
          return {
            ...photo,
            placeName: placeData?.name || '알 수 없음',
          };
        } catch {
          return {
            ...photo,
            placeName: '알 수 없음',
          };
        }
      })
    );

    return NextResponse.json({
      photos: photosWithPlace,
      hasMore,
    });
  } catch (error) {
    console.error('Failed to fetch photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}
