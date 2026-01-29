import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * GET /api/places/[placeId]
 * 장소 정보 조회 (모든 사용자 가능, 공개 정보)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  try {
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const { placeId } = await params;

    const placeDoc = await adminDb.collection('places').doc(placeId).get();

    if (!placeDoc.exists) {
      return NextResponse.json(
        { error: 'Place not found' },
        { status: 404 }
      );
    }

    const data = placeDoc.data()!;

    return NextResponse.json({
      placeId: placeDoc.id,
      name: data.name,
      address: data.address,
      lat: data.lat,
      lng: data.lng,
      category: data.category,
      categoryCode: data.categoryCode,
      categoryKey: data.categoryKey,
      source: data.source,
      status: data.status,
      mapProvider: data.mapProvider,
      cellId: data.cellId,
      geohash: data.geohash,
      avgTier: data.avgTier || null,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate()?.toISOString(),
    });
  } catch (error) {
    console.error('Place fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch place' },
      { status: 500 }
    );
  }
}
