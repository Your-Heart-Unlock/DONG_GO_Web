import { db } from './client';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { Badge, UserBadge, UserBadgeCollection, RatingTier } from '@/types';

/**
 * 뱃지 정의 목록
 */
export const BADGES: Badge[] = [
  // ===== 리뷰 관련 =====
  {
    badgeId: 'first_review',
    name: '첫 리뷰',
    description: '첫 리뷰를 작성했어요',
    icon: '✍️',
    condition: { type: 'review_count', threshold: 1 },
    rarity: 'common',
  },
  {
    badgeId: 'reviewer_10',
    name: '리뷰어',
    description: '리뷰 10개 작성',
    icon: '📝',
    condition: { type: 'review_count', threshold: 10 },
    rarity: 'common',
  },
  {
    badgeId: 'reviewer_30',
    name: '열정 리뷰어',
    description: '리뷰 30개 작성',
    icon: '🔥',
    condition: { type: 'review_count', threshold: 30 },
    rarity: 'rare',
  },
  {
    badgeId: 'veteran_50',
    name: '베테랑',
    description: '리뷰 50개 작성',
    icon: '🎖️',
    condition: { type: 'review_count', threshold: 50 },
    rarity: 'rare',
  },
  {
    badgeId: 'master_100',
    name: '마스터',
    description: '리뷰 100개 작성',
    icon: '🏅',
    condition: { type: 'review_count', threshold: 100 },
    rarity: 'epic',
  },
  {
    badgeId: 'legend_200',
    name: '레전드',
    description: '리뷰 200개 작성',
    icon: '👑',
    condition: { type: 'review_count', threshold: 200 },
    rarity: 'legendary',
  },

  // ===== 장소 추가 관련 =====
  {
    badgeId: 'first_place',
    name: '발견자',
    description: '첫 맛집을 등록했어요',
    icon: '📍',
    condition: { type: 'place_add', threshold: 1 },
    rarity: 'common',
  },
  {
    badgeId: 'explorer_5',
    name: '탐험가',
    description: '맛집 5개 등록',
    icon: '🗺️',
    condition: { type: 'place_add', threshold: 5 },
    rarity: 'common',
  },
  {
    badgeId: 'discoverer_10',
    name: '개척자',
    description: '맛집 10개 등록',
    icon: '🔍',
    condition: { type: 'place_add', threshold: 10 },
    rarity: 'rare',
  },
  {
    badgeId: 'pioneer_20',
    name: '선구자',
    description: '맛집 20개 등록',
    icon: '🌟',
    condition: { type: 'place_add', threshold: 20 },
    rarity: 'epic',
  },

  // ===== S등급 관련 =====
  {
    badgeId: 's_tier_5',
    name: '명가 발굴러',
    description: 'S등급 5개 달성',
    icon: '⭐',
    condition: { type: 'tier_s', threshold: 5 },
    rarity: 'common',
  },
  {
    badgeId: 's_tier_10',
    name: '완벽주의자',
    description: 'S등급 10개 달성',
    icon: '🌟',
    condition: { type: 'tier_s', threshold: 10 },
    rarity: 'rare',
  },
  {
    badgeId: 's_tier_20',
    name: '별 수집가',
    description: 'S등급 20개 달성',
    icon: '✨',
    condition: { type: 'tier_s', threshold: 20 },
    rarity: 'epic',
  },
  {
    badgeId: 's_tier_50',
    name: '미쉐린 가이드',
    description: 'S등급 50개 달성',
    icon: '🏆',
    condition: { type: 'tier_s', threshold: 50 },
    rarity: 'legendary',
  },
];

/**
 * 뱃지 ID로 뱃지 정보 조회
 */
export function getBadgeInfo(badgeId: string): Badge | undefined {
  return BADGES.find((b) => b.badgeId === badgeId);
}

/**
 * 사용자의 뱃지 컬렉션 조회
 */
export async function getUserBadges(uid: string): Promise<UserBadgeCollection | null> {
  if (!db) return null;

  try {
    const badgeRef = doc(db, 'user_badges', uid);
    const snapshot = await getDoc(badgeRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();
    return {
      uid: data.uid,
      badges: (data.badges || []).map((b: { badgeId: string; earnedAt: { toDate?: () => Date } }) => ({
        badgeId: b.badgeId,
        earnedAt: b.earnedAt?.toDate?.() || new Date(),
      })),
      representativeBadgeId: data.representativeBadgeId,
      updatedAt: data.updatedAt?.toDate?.() || new Date(),
    };
  } catch (error) {
    console.error('Failed to get user badges:', error);
    return null;
  }
}

/**
 * 사용자 통계를 기반으로 뱃지 체크 및 부여
 * @returns 새로 획득한 뱃지 ID 배열
 */
export async function checkAndAwardBadges(uid: string): Promise<string[]> {
  if (!db) return [];

  try {
    // 1. 현재 보유 뱃지 조회
    const currentBadges = await getUserBadges(uid);
    const earnedBadgeIds = new Set(currentBadges?.badges.map((b) => b.badgeId) || []);

    // 2. 사용자 통계 수집
    // 리뷰 수
    const reviewsQuery = query(collection(db, 'reviews'), where('uid', '==', uid));
    const reviewsSnapshot = await getDocs(reviewsQuery);
    const reviewCount = reviewsSnapshot.size;

    // S등급 수
    let sCount = 0;
    const tierCounts: Record<RatingTier, number> = { S: 0, A: 0, B: 0, C: 0, F: 0 };
    reviewsSnapshot.docs.forEach((doc) => {
      const tier = doc.data().ratingTier as RatingTier;
      if (tier) {
        tierCounts[tier] = (tierCounts[tier] || 0) + 1;
        if (tier === 'S') sCount++;
      }
    });

    // 장소 등록 수
    const placesQuery = query(collection(db, 'places'), where('createdBy', '==', uid));
    const placesSnapshot = await getDocs(placesQuery);
    const placeCount = placesSnapshot.size;

    // 3. 각 뱃지 조건 체크
    const newBadges: string[] = [];

    for (const badge of BADGES) {
      // 이미 획득한 뱃지는 스킵
      if (earnedBadgeIds.has(badge.badgeId)) continue;

      let earned = false;

      switch (badge.condition.type) {
        case 'review_count':
          earned = reviewCount >= badge.condition.threshold;
          break;
        case 'place_add':
          earned = placeCount >= badge.condition.threshold;
          break;
        case 'tier_s':
          earned = sCount >= badge.condition.threshold;
          break;
      }

      if (earned) {
        newBadges.push(badge.badgeId);
      }
    }

    // 4. 새 뱃지 저장
    if (newBadges.length > 0) {
      const badgeRef = doc(db, 'user_badges', uid);
      const existingBadges = currentBadges?.badges || [];

      const newUserBadges: UserBadge[] = newBadges.map((badgeId) => ({
        badgeId,
        earnedAt: new Date(),
      }));

      const allBadges = [...existingBadges, ...newUserBadges];

      await setDoc(
        badgeRef,
        {
          uid,
          badges: allBadges.map((b) => ({
            badgeId: b.badgeId,
            earnedAt: b.earnedAt,
          })),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`[badges] ${uid}님에게 새 뱃지 부여:`, newBadges);
    }

    return newBadges;
  } catch (error) {
    console.error('Failed to check and award badges:', error);
    return [];
  }
}

/**
 * 대표 뱃지 설정
 */
export async function setRepresentativeBadge(uid: string, badgeId: string): Promise<boolean> {
  if (!db) return false;

  try {
    // 해당 뱃지를 보유하고 있는지 확인
    const userBadges = await getUserBadges(uid);
    if (!userBadges) {
      throw new Error('뱃지 컬렉션이 없습니다.');
    }

    const hasBadge = userBadges.badges.some((b) => b.badgeId === badgeId);
    if (!hasBadge) {
      throw new Error('보유하지 않은 뱃지입니다.');
    }

    // 대표 뱃지 설정
    const badgeRef = doc(db, 'user_badges', uid);
    await updateDoc(badgeRef, {
      representativeBadgeId: badgeId,
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error('Failed to set representative badge:', error);
    throw error;
  }
}

/**
 * 대표 뱃지 해제
 */
export async function clearRepresentativeBadge(uid: string): Promise<boolean> {
  if (!db) return false;

  try {
    const badgeRef = doc(db, 'user_badges', uid);
    await updateDoc(badgeRef, {
      representativeBadgeId: null,
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error('Failed to clear representative badge:', error);
    throw error;
  }
}

/**
 * 희귀도별 색상 가져오기
 */
export function getRarityColors(rarity: Badge['rarity']): { bg: string; border: string; text: string } {
  switch (rarity) {
    case 'common':
      return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-600' };
    case 'rare':
      return { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-600' };
    case 'epic':
      return { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-600' };
    case 'legendary':
      return { bg: 'bg-gradient-to-br from-yellow-100 to-amber-100', border: 'border-yellow-400', text: 'text-yellow-700' };
    default:
      return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-600' };
  }
}

/**
 * 희귀도 라벨 가져오기
 */
export function getRarityLabel(rarity: Badge['rarity']): string {
  switch (rarity) {
    case 'common':
      return '일반';
    case 'rare':
      return '희귀';
    case 'epic':
      return '영웅';
    case 'legendary':
      return '전설';
    default:
      return '일반';
  }
}
