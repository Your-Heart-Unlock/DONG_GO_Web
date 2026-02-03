/**
 * Calculate record points for a single review.
 *
 * Scoring:
 * - visitedAt present: +1
 * - oneLineReview >= 20 chars: +1
 * - revisitIntent set (true or false): +1
 * - companions set (non-empty): +1
 * - photos: +2 (MVP에서는 제외)
 */
export function calculateRecordPoints(review: {
  visitedAt?: Date | unknown;
  oneLineReview?: string;
  revisitIntent?: boolean;
  companions?: string;
}): number {
  let points = 0;
  if (review.visitedAt) points += 1;
  if (review.oneLineReview && review.oneLineReview.length >= 20) points += 1;
  if (review.revisitIntent !== undefined && review.revisitIntent !== null) points += 1;
  if (review.companions && review.companions.trim().length > 0) points += 1;
  return points;
}
