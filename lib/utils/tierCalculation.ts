import { RatingTier } from '@/types';

export const TIER_WEIGHTS: Record<RatingTier, number> = {
  S: 5,
  A: 4,
  B: 3,
  C: 2,
  F: 1,
};

/**
 * tierCounts와 총 리뷰 수로 평균 등급 계산
 */
export function computeAverageTier(
  tierCounts: Record<RatingTier, number>,
  total: number
): RatingTier | null {
  if (total === 0) return null;

  const sum = Object.entries(tierCounts).reduce(
    (acc, [tier, count]) => acc + TIER_WEIGHTS[tier as RatingTier] * count,
    0
  );
  const avg = sum / total;

  if (avg >= 4.5) return 'S';
  if (avg >= 3.5) return 'A';
  if (avg >= 2.5) return 'B';
  if (avg >= 1.5) return 'C';
  return 'F';
}
