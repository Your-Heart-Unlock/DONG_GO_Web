import { NextRequest, NextResponse } from 'next/server';
import { requireMember } from '@/lib/auth/verifyAuth';

/**
 * GET /api/photos
 * 모든 사진 목록 조회 (member/owner만)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMember(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 모든 사진 조회 (최신순)
    const photosSnapshot = await db
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
          const placeDoc = await db.collection('places').doc(photo.placeId).get();
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
