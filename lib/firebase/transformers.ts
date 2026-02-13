import { Place } from '@/types';

/**
 * Firestore Place 문서를 Place 타입으로 변환
 * Client SDK (DocumentSnapshot) 용
 */
export function transformPlaceDoc(docSnap: { id: string; data: () => Record<string, any> | undefined }): Place | null {
  const data = docSnap.data();
  if (!data) return null;

  return {
    placeId: docSnap.id,
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
    naverPlaceId: data.naverPlaceId,
    kakaoPlaceId: data.kakaoPlaceId,
    cellId: data.cellId,
    geohash: data.geohash,
    createdBy: data.createdBy || '',
    createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
  };
}
