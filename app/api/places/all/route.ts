import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/places/all
 * 클러스터링을 위한 전체 장소 조회 (간소화된 데이터)
 * 인증 없이 접근 가능 (공개 데이터)
 */
export async function GET() {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // 전체 장소 조회 (active 상태만)
    const placesSnapshot = await adminDb
      .collection('places')
      .where('status', '==', 'active')
      .get();

    // 클러스터링에 필요한 최소 데이터만 반환
    const places = placesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        placeId: doc.id,
        name: data.name,
        lat: data.lat,
        lng: data.lng,
        categoryKey: data.categoryKey || 'Idle',
        avgTier: data.avgTier || null,
      };
    });

    console.log(`[API] /api/places/all - 전체 ${places.length}개 장소 반환`);

    return NextResponse.json({
      places,
      total: places.length,
    });
  } catch (error) {
    console.error('Failed to fetch all places:', error);
    return NextResponse.json(
      { error: 'Failed to fetch places' },
      { status: 500 }
    );
  }
}
