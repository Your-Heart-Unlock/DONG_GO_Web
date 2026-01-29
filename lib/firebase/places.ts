import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  limit,
  orderBy,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
  documentId,
  arrayUnion,
} from 'firebase/firestore';
import { db } from './client';
import { Place, RatingTier, PlaceStats } from '@/types';
import { computeCellId } from '@/lib/utils/cellId';
import {
  encodeGeohash,
  getGeohashPrefixesForNearbySearch,
  calculateDistance,
  DUPLICATE_THRESHOLD_METERS,
} from '@/lib/utils/geohash';
import { inferCategoryKey } from '@/lib/utils/categoryIcon';

/**
 * 최근 장소 N개 가져오기
 */
export async function getRecentPlaces(limitCount: number = 50): Promise<Place[]> {
  if (!db) {
    console.warn('Firestore is not initialized');
    return [];
  }

  try {
    const placesRef = collection(db, 'places');
    const q = query(
      placesRef,
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      placeId: doc.id,
      name: doc.data().name,
      address: doc.data().address,
      lat: doc.data().lat,
      lng: doc.data().lng,
      category: doc.data().category,
      categoryCode: doc.data().categoryCode,
      categoryKey: doc.data().categoryKey,
      source: doc.data().source,
      status: doc.data().status,
      mapProvider: doc.data().mapProvider,
      cellId: doc.data().cellId,
      registeredBy: doc.data().registeredBy || [doc.data().createdBy], // 하위 호환
      createdBy: doc.data().createdBy,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate(),
    }));
  } catch (error) {
    console.error('Failed to fetch places:', error);
    return [];
  }
}

/**
 * 특정 장소 가져오기
 */
export async function getPlaceById(placeId: string): Promise<Place | null> {
  if (!db) {
    console.warn('Firestore is not initialized');
    return null;
  }

  try {
    const placeRef = doc(db, 'places', placeId);
    const placeSnap = await getDoc(placeRef);

    if (!placeSnap.exists()) {
      return null;
    }

    const data = placeSnap.data();
    return {
      placeId: placeSnap.id,
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
      registeredBy: data.registeredBy || [data.createdBy],
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate(),
    };
  } catch (error) {
    console.error('Failed to fetch place:', error);
    return null;
  }
}

/**
 * 장소 생성 (member/owner만)
 */
export async function createPlace(place: Omit<Place, 'createdAt' | 'updatedAt' | 'registeredBy'>) {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const placeRef = doc(db, 'places', place.placeId);

  // 이미 존재하는지 체크
  const existing = await getDoc(placeRef);
  if (existing.exists()) {
    throw new Error('Place already exists');
  }

  await setDoc(placeRef, {
    ...place,
    cellId: computeCellId(place.lat, place.lng),
    geohash: encodeGeohash(place.lat, place.lng),
    categoryKey: place.categoryKey || inferCategoryKey(place.category),
    registeredBy: [place.createdBy], // 최초 등록자를 배열로 저장
    createdAt: serverTimestamp(),
  });
}

/**
 * 기존 장소에 등록자 추가 (이미 등록된 장소를 다시 등록하는 경우)
 */
export async function addRegistrant(placeId: string, uid: string) {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const placeRef = doc(db, 'places', placeId);
  await updateDoc(placeRef, {
    registeredBy: arrayUnion(uid),
    updatedAt: serverTimestamp(),
  });
}

/**
 * 장소 업데이트 (owner만)
 */
export async function updatePlace(placeId: string, updates: Partial<Place>) {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const placeRef = doc(db, 'places', placeId);
  await updateDoc(placeRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 장소 숨김 처리 (owner만)
 */
export async function hidePlace(placeId: string) {
  await updatePlace(placeId, { status: 'hidden' });
}

/**
 * 장소 숨김 해제 (owner만)
 */
export async function unhidePlace(placeId: string) {
  await updatePlace(placeId, { status: 'active' });
}

/**
 * tierCounts에서 평균 등급 계산
 */
function calculateAvgTier(stats: PlaceStats | null): RatingTier | null {
  if (!stats || stats.reviewCount === 0) return null;

  const tierWeights: Record<RatingTier, number> = { S: 5, A: 4, B: 3, C: 2, F: 1 };
  const totalWeight = Object.entries(stats.tierCounts).reduce(
    (sum, [tier, count]) => sum + tierWeights[tier as RatingTier] * count,
    0
  );
  const avgWeight = totalWeight / stats.reviewCount;

  if (avgWeight >= 4.5) return 'S';
  if (avgWeight >= 3.5) return 'A';
  if (avgWeight >= 2.5) return 'B';
  if (avgWeight >= 1.5) return 'C';
  return 'F';
}

/**
 * cellId 배열로 장소 조회 (bounds 기반 지도 로딩)
 * Firestore 'in' 쿼리는 최대 30개까지 지원하므로, 30개씩 나눠서 쿼리
 * stats도 함께 조회하여 avgTier 계산
 */
export async function getPlacesByCellIds(cellIds: string[]): Promise<Place[]> {
  if (!db || cellIds.length === 0) return [];

  try {
    const placesRef = collection(db, 'places');
    const BATCH_SIZE = 30; // Firestore 'in' 쿼리 최대 크기
    const allPlaces: Place[] = [];

    // cellIds를 30개씩 나눠서 쿼리
    for (let i = 0; i < cellIds.length; i += BATCH_SIZE) {
      const batch = cellIds.slice(i, i + BATCH_SIZE);

      const q = query(
        placesRef,
        where('status', '==', 'active'),
        where('cellId', 'in', batch)
      );

      const snapshot = await getDocs(q);
      const places = snapshot.docs.map((docSnap) => ({
        placeId: docSnap.id,
        name: docSnap.data().name,
        address: docSnap.data().address,
        lat: docSnap.data().lat,
        lng: docSnap.data().lng,
        category: docSnap.data().category,
        categoryCode: docSnap.data().categoryCode,
        categoryKey: docSnap.data().categoryKey,
        source: docSnap.data().source,
        status: docSnap.data().status,
        mapProvider: docSnap.data().mapProvider,
        cellId: docSnap.data().cellId,
        registeredBy: docSnap.data().registeredBy || [docSnap.data().createdBy],
        createdBy: docSnap.data().createdBy,
        createdAt: docSnap.data().createdAt?.toDate() || new Date(),
        updatedAt: docSnap.data().updatedAt?.toDate(),
      }));

      allPlaces.push(...places);
    }

    // stats 조회하여 avgTier 계산
    const placeIds = allPlaces.map(p => p.placeId);
    const statsMap = new Map<string, PlaceStats>();

    // stats도 30개씩 나눠서 조회
    for (let i = 0; i < placeIds.length; i += BATCH_SIZE) {
      const batch = placeIds.slice(i, i + BATCH_SIZE);
      const statsPromises = batch.map(id => getDoc(doc(db!, 'stats', id)));
      const statsSnapshots = await Promise.all(statsPromises);

      statsSnapshots.forEach((snap, idx) => {
        if (snap.exists()) {
          const data = snap.data();
          statsMap.set(batch[idx], {
            reviewCount: data.reviewCount || 0,
            tierCounts: data.tierCounts || { S: 0, A: 0, B: 0, C: 0, F: 0 },
            topTags: data.topTags || [],
            reviewerUids: data.reviewerUids || [],
          });
        }
      });
    }

    // avgTier 추가
    return allPlaces.map(place => ({
      ...place,
      avgTier: calculateAvgTier(statsMap.get(place.placeId) || null),
    }));
  } catch (error) {
    console.error('Failed to fetch places by cellIds:', error);
    return [];
  }
}

/**
 * 좌표 기반 중복 체크 - 100m 이내 장소 검색
 * geohash prefix를 사용하여 효율적으로 검색
 */
export async function findNearbyPlaces(
  lat: number,
  lng: number,
  excludePlaceId?: string
): Promise<Place[]> {
  if (!db) {
    console.warn('Firestore is not initialized');
    return [];
  }

  try {
    const placesRef = collection(db, 'places');
    const prefixes = getGeohashPrefixesForNearbySearch(lat, lng);

    // 각 prefix에 대해 range 쿼리 실행
    const candidates: Place[] = [];

    for (const prefix of prefixes) {
      const q = query(
        placesRef,
        where('status', '==', 'active'),
        where('geohash', '>=', prefix),
        where('geohash', '<=', prefix + '~')
      );

      const snapshot = await getDocs(q);
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        // excludePlaceId가 지정된 경우 해당 장소 제외
        if (excludePlaceId && docSnap.id === excludePlaceId) return;

        candidates.push({
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
          cellId: data.cellId,
          geohash: data.geohash,
          registeredBy: data.registeredBy || [data.createdBy],
          createdBy: data.createdBy,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
        });
      });
    }

    // 중복 제거 (여러 prefix 쿼리에서 같은 장소가 나올 수 있음)
    const uniqueCandidates = Array.from(
      new Map(candidates.map((p) => [p.placeId, p])).values()
    );

    // 실제 거리 계산하여 100m 이내만 필터링
    const nearbyPlaces = uniqueCandidates.filter((place) => {
      const distance = calculateDistance(lat, lng, place.lat, place.lng);
      return distance <= DUPLICATE_THRESHOLD_METERS;
    });

    return nearbyPlaces;
  } catch (error) {
    console.error('Failed to find nearby places:', error);
    return [];
  }
}
