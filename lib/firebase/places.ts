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
} from 'firebase/firestore';
import { db } from './client';
import { Place } from '@/types';

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
      source: doc.data().source,
      status: doc.data().status,
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
      source: data.source,
      status: data.status,
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
export async function createPlace(place: Omit<Place, 'createdAt' | 'updatedAt'>) {
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
    createdAt: serverTimestamp(),
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
