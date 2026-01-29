import {
  collection,
  query,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  where,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './client';
import { Review, PlaceStats, RatingTier } from '@/types';

/**
 * placeId 기준 리뷰 목록 (createdAt desc)
 * 각 리뷰에 작성자 닉네임을 join
 */
export async function getReviewsByPlaceId(placeId: string): Promise<Review[]> {
  if (!db) {
    console.warn('Firestore is not initialized');
    return [];
  }

  try {
    const reviewsRef = collection(db, 'reviews');
    const q = query(
      reviewsRef,
      where('placeId', '==', placeId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const reviews: Review[] = [];

    for (const reviewDoc of snapshot.docs) {
      const data = reviewDoc.data();

      // 작성자 닉네임 join
      let nickname = '알 수 없음';
      try {
        const userSnap = await getDoc(doc(db, 'users', data.uid));
        if (userSnap.exists()) {
          nickname = userSnap.data().nickname || '익명';
        }
      } catch {
        // 닉네임 조회 실패 시 기본값 사용
      }

      reviews.push({
        reviewId: reviewDoc.id,
        placeId: data.placeId,
        uid: data.uid,
        nickname,
        ratingTier: data.ratingTier,
        oneLineReview: data.oneLineReview,
        tags: data.tags,
        visitedAt: data.visitedAt?.toDate?.() ?? undefined,
        companions: data.companions ?? undefined,
        revisitIntent: data.revisitIntent ?? undefined,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
      });
    }

    return reviews;
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return [];
  }
}

/**
 * stats 문서 재계산 (모든 리뷰 기반)
 */
async function recalculateStats(placeId: string): Promise<void> {
  if (!db) return;

  const reviewsRef = collection(db, 'reviews');
  const q = query(reviewsRef, where('placeId', '==', placeId));
  const snapshot = await getDocs(q);

  const tierCounts: PlaceStats['tierCounts'] = { S: 0, A: 0, B: 0, C: 0, F: 0 };
  const tagCounts: Record<string, number> = {};
  const reviewerUidSet = new Set<string>();

  snapshot.docs.forEach((d) => {
    const data = d.data();
    const tier = data.ratingTier as RatingTier;
    if (tier in tierCounts) {
      tierCounts[tier]++;
    }
    if (data.tags && Array.isArray(data.tags)) {
      data.tags.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
    if (data.uid) {
      reviewerUidSet.add(data.uid);
    }
  });

  // 상위 태그 5개
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);

  const statsRef = doc(db, 'stats', placeId);
  const statsSnap = await getDoc(statsRef);

  const statsData: PlaceStats = {
    reviewCount: snapshot.size,
    tierCounts,
    topTags,
    reviewerUids: Array.from(reviewerUidSet),
  };

  if (statsSnap.exists()) {
    await updateDoc(statsRef, { ...statsData });
  } else {
    await setDoc(statsRef, statsData);
  }
}

/**
 * 리뷰 생성 + stats 업데이트
 */
export async function createReview(review: {
  placeId: string;
  uid: string;
  ratingTier: RatingTier;
  oneLineReview?: string;
  tags?: string[];
  visitedAt?: Date;
  companions?: string;
  revisitIntent?: boolean;
}): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const reviewsRef = collection(db, 'reviews');
  const docData: Record<string, unknown> = {
    placeId: review.placeId,
    uid: review.uid,
    ratingTier: review.ratingTier,
    oneLineReview: review.oneLineReview || '',
    tags: review.tags || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (review.visitedAt) docData.visitedAt = review.visitedAt;
  if (review.companions) docData.companions = review.companions;
  if (review.revisitIntent !== undefined) docData.revisitIntent = review.revisitIntent;

  await addDoc(reviewsRef, docData);

  // stats 업데이트는 실패해도 리뷰 저장에 영향을 주지 않음
  try {
    await recalculateStats(review.placeId);
  } catch (error) {
    console.warn('Stats 업데이트 실패 (리뷰는 저장됨):', error);
  }
}

/**
 * 리뷰 수정 + stats 재계산
 */
export async function updateReview(
  reviewId: string,
  updates: {
    ratingTier?: RatingTier;
    oneLineReview?: string;
    tags?: string[];
    visitedAt?: Date;
    companions?: string;
    revisitIntent?: boolean;
  }
): Promise<string> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const reviewRef = doc(db, 'reviews', reviewId);
  const reviewSnap = await getDoc(reviewRef);
  if (!reviewSnap.exists()) {
    throw new Error('Review not found');
  }

  const placeId = reviewSnap.data().placeId;

  await updateDoc(reviewRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });

  try {
    await recalculateStats(placeId);
  } catch (error) {
    console.warn('Stats 업데이트 실패 (리뷰는 수정됨):', error);
  }
  return placeId;
}

/**
 * 리뷰 삭제 + stats 업데이트
 */
export async function deleteReview(reviewId: string, placeId: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const reviewRef = doc(db, 'reviews', reviewId);
  await deleteDoc(reviewRef);

  try {
    await recalculateStats(placeId);
  } catch (error) {
    console.warn('Stats 업데이트 실패 (리뷰는 삭제됨):', error);
  }
}

/**
 * 특정 사용자가 리뷰한 장소 placeId 목록 조회
 * (지도에서 리뷰 여부 구분 시 사용)
 */
export async function getReviewedPlaceIds(uid: string): Promise<Set<string>> {
  if (!db) {
    console.warn('Firestore is not initialized');
    return new Set();
  }

  try {
    const reviewsRef = collection(db, 'reviews');
    const q = query(reviewsRef, where('uid', '==', uid));
    const snapshot = await getDocs(q);

    const placeIds = new Set<string>();
    snapshot.docs.forEach((d) => {
      placeIds.add(d.data().placeId);
    });

    return placeIds;
  } catch (error) {
    console.error('Failed to fetch reviewed place IDs:', error);
    return new Set();
  }
}

/**
 * 장소 stats 가져오기
 */
export async function getPlaceStats(placeId: string): Promise<PlaceStats | null> {
  if (!db) {
    console.warn('Firestore is not initialized');
    return null;
  }

  try {
    const statsRef = doc(db, 'stats', placeId);
    let statsSnap = await getDoc(statsRef);

    // stats 문서가 없으면 리뷰 기반으로 재계산 후 다시 조회
    if (!statsSnap.exists()) {
      await recalculateStats(placeId);
      statsSnap = await getDoc(statsRef);
      if (!statsSnap.exists()) return null;
    }

    const data = statsSnap.data();
    return {
      reviewCount: data.reviewCount || 0,
      tierCounts: data.tierCounts || { S: 0, A: 0, B: 0, C: 0, F: 0 },
      topTags: data.topTags || [],
      reviewerUids: data.reviewerUids || [],
    };
  } catch (error) {
    console.error('Failed to fetch place stats:', error);
    return null;
  }
}
