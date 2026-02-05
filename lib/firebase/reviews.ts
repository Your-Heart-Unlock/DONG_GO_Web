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
  increment,
} from 'firebase/firestore';
import { db } from './client';
import { Review, PlaceStats, RatingTier, CategoryKey } from '@/types';
import { getCurrentMonthKey } from '@/lib/utils/monthKey';
import { calculateRecordPoints } from '@/lib/utils/recordPoints';

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
 * monthly_user_stats 업데이트 (리뷰 생성/삭제 시)
 */
async function updateMonthlyUserStats(
  uid: string,
  tier: RatingTier,
  categoryKey: CategoryKey | undefined,
  recordPoints: number,
  delta: 1 | -1
): Promise<void> {
  if (!db) return;

  const monthKey = getCurrentMonthKey();
  const statsRef = doc(db, 'monthly_user_stats', monthKey, 'users', uid);

  try {
    const statsSnap = await getDoc(statsRef);

    if (statsSnap.exists()) {
      // 기존 문서 업데이트
      const updateData: Record<string, unknown> = {
        reviews: increment(delta),
        recordPoints: increment(recordPoints * delta),
        [`tierCounts.${tier}`]: increment(delta),
        lastActiveAt: serverTimestamp(),
      };
      if (categoryKey) {
        updateData[`categoryReviews.${categoryKey}`] = increment(delta);
      }
      await updateDoc(statsRef, updateData);
    } else if (delta === 1) {
      // 신규 문서 생성 (생성 시에만)
      const newStats = {
        month: monthKey,
        uid,
        reviews: 1,
        recordPoints,
        tierCounts: { S: 0, A: 0, B: 0, C: 0, F: 0, [tier]: 1 },
        categoryReviews: categoryKey ? { [categoryKey]: 1 } : {},
        lastActiveAt: serverTimestamp(),
      };
      await setDoc(statsRef, newStats);
    }
  } catch (error) {
    console.warn('Monthly user stats 업데이트 실패:', error);
  }
}

/**
 * 리뷰 생성 + stats 업데이트 + monthly_user_stats 업데이트
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
  categoryKey?: CategoryKey; // 장소의 카테고리 (리더보드용)
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
  if (review.categoryKey) docData.categoryKey = review.categoryKey;

  await addDoc(reviewsRef, docData);

  // 기록왕 포인트 계산
  const recordPoints = calculateRecordPoints(review);

  // stats 업데이트는 실패해도 리뷰 저장에 영향을 주지 않음
  try {
    await recalculateStats(review.placeId);
  } catch (error) {
    console.warn('Stats 업데이트 실패 (리뷰는 저장됨):', error);
  }

  // monthly_user_stats 업데이트
  try {
    await updateMonthlyUserStats(
      review.uid,
      review.ratingTier,
      review.categoryKey,
      recordPoints,
      1
    );
  } catch (error) {
    console.warn('Monthly user stats 업데이트 실패 (리뷰는 저장됨):', error);
  }

  // 뱃지 체크 (비동기로 실행, 실패해도 무시)
  import('@/lib/firebase/badges').then(({ checkAndAwardBadges }) => {
    checkAndAwardBadges(review.uid).catch((error) => {
      console.warn('뱃지 체크 실패 (리뷰는 저장됨):', error);
    });
  });
}

/**
 * 리뷰 수정 + stats 재계산 + monthly_user_stats delta 업데이트
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

  const oldData = reviewSnap.data();
  const placeId = oldData.placeId;
  const uid = oldData.uid;
  const oldTier = oldData.ratingTier as RatingTier;
  const categoryKey = oldData.categoryKey as CategoryKey | undefined;

  // 기존 포인트 계산
  const oldPoints = calculateRecordPoints({
    visitedAt: oldData.visitedAt?.toDate?.(),
    oneLineReview: oldData.oneLineReview,
    revisitIntent: oldData.revisitIntent,
    companions: oldData.companions,
  });

  // undefined 값 필터링 (Firestore는 undefined를 허용하지 않음)
  const filteredUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.ratingTier !== undefined) filteredUpdates.ratingTier = updates.ratingTier;
  if (updates.oneLineReview !== undefined) filteredUpdates.oneLineReview = updates.oneLineReview;
  if (updates.tags !== undefined) filteredUpdates.tags = updates.tags;
  if (updates.visitedAt !== undefined) filteredUpdates.visitedAt = updates.visitedAt;
  if (updates.companions !== undefined) filteredUpdates.companions = updates.companions;
  if (updates.revisitIntent !== undefined) filteredUpdates.revisitIntent = updates.revisitIntent;

  await updateDoc(reviewRef, filteredUpdates);

  // 새 포인트 계산
  const newPoints = calculateRecordPoints({
    visitedAt: updates.visitedAt ?? oldData.visitedAt?.toDate?.(),
    oneLineReview: updates.oneLineReview ?? oldData.oneLineReview,
    revisitIntent: updates.revisitIntent ?? oldData.revisitIntent,
    companions: updates.companions ?? oldData.companions,
  });

  try {
    await recalculateStats(placeId);
  } catch (error) {
    console.warn('Stats 업데이트 실패 (리뷰는 수정됨):', error);
  }

  // monthly_user_stats delta 업데이트
  const newTier = updates.ratingTier ?? oldTier;
  const pointsDelta = newPoints - oldPoints;

  if (oldTier !== newTier || pointsDelta !== 0) {
    try {
      const monthKey = getCurrentMonthKey();
      const statsRef = doc(db, 'monthly_user_stats', monthKey, 'users', uid);
      const statsSnap = await getDoc(statsRef);

      if (statsSnap.exists()) {
        const updateData: Record<string, unknown> = {
          lastActiveAt: serverTimestamp(),
        };
        if (pointsDelta !== 0) {
          updateData.recordPoints = increment(pointsDelta);
        }
        if (oldTier !== newTier) {
          updateData[`tierCounts.${oldTier}`] = increment(-1);
          updateData[`tierCounts.${newTier}`] = increment(1);
        }
        await updateDoc(statsRef, updateData);
      }
    } catch (error) {
      console.warn('Monthly user stats delta 업데이트 실패:', error);
    }
  }

  return placeId;
}

/**
 * 리뷰 삭제 + stats 업데이트 + monthly_user_stats decrement
 */
export async function deleteReview(reviewId: string, placeId: string): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const reviewRef = doc(db, 'reviews', reviewId);

  // 삭제 전 데이터 읽기
  const reviewSnap = await getDoc(reviewRef);
  if (!reviewSnap.exists()) {
    throw new Error('Review not found');
  }

  const data = reviewSnap.data();
  const uid = data.uid;
  const tier = data.ratingTier as RatingTier;
  const categoryKey = data.categoryKey as CategoryKey | undefined;

  // 기록왕 포인트 계산
  const recordPoints = calculateRecordPoints({
    visitedAt: data.visitedAt?.toDate?.(),
    oneLineReview: data.oneLineReview,
    revisitIntent: data.revisitIntent,
    companions: data.companions,
  });

  await deleteDoc(reviewRef);

  try {
    await recalculateStats(placeId);
  } catch (error) {
    console.warn('Stats 업데이트 실패 (리뷰는 삭제됨):', error);
  }

  // monthly_user_stats decrement
  try {
    await updateMonthlyUserStats(uid, tier, categoryKey, recordPoints, -1);
  } catch (error) {
    console.warn('Monthly user stats decrement 실패 (리뷰는 삭제됨):', error);
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
