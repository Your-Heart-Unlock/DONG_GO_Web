# Reviews & Rating System

## Rating Tiers

| Tier | Score | Label |
|------|-------|-------|
| S | 5 | 최고 |
| A | 4 | 좋음 |
| B | 3 | 보통 |
| C | 2 | 별로 |
| F | 1 | 최악 |

## Average Tier Calculation

Shared utility in `lib/utils/tierCalculation.ts`:
```
avg = sum(tier_score * count) / total_reviews
S: avg >= 4.5
A: avg >= 3.5
B: avg >= 2.5
C: avg >= 1.5
F: avg < 1.5
```

## IMDB Weighted Rating (Top 10)

For service-wide Top 10 ranking (`/api/stats/total`):
```
Score = (v / (v + m)) * R + (m / (v + m)) * C
```
- `v`: review count for this place
- `m`: minimum reviews threshold (3)
- `R`: place's average score (tier-to-score)
- `C`: global average score across all places

Places with fewer than `m` reviews are excluded from ranking.

## Record Points

Each review earns record points based on detail level (`lib/utils/recordPoints.ts`):
- Base: 1 point per review
- +1 for visitedAt date
- +1 for oneLineReview text
- +1 for revisitIntent
- +1 for companions info

## Review Flow

1. User selects a place on the map
2. Opens review form in bottom sheet
3. Sets rating tier (required), optional fields
4. On submit:
   - Review saved to `reviews` collection
   - `stats/{placeId}` updated (reviewCount, tierCounts, etc.)
   - `monthly_user_stats` updated (increment for current month)
   - Badge check triggered

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/me/reviews | member | My reviews (paginated) |
| GET | /api/me/stats | member | My statistics |
