# Leaderboard & Statistics

## Monthly Leaderboard (Hall of Fame)

### Data Flow
1. **Daily cron** (`/api/cron/monthly-snapshot`, 매일 18:10 UTC = 03:10 KST)
   - Reads `monthly_user_stats/{currentMonth}/users/*`
   - Calculates rankings
   - Saves to `monthly_leaderboard/{monthKey}`
   - Saves to `monthly_service_stats/{monthKey}`

2. **Display** shows **previous month's** data (not current month)
   - In February, January's leaderboard is shown
   - Uses `getPreviousMonthKey()` from `lib/utils/monthKey.ts`

### Rankings
- **리뷰왕**: Top 10 by review count
- **기록왕**: Top 10 by record points
- **종합**: Top 10 by (reviews + recordPoints)
- **카테고리 챔피언**: #1 reviewer per category

### Month Navigation
- Users can navigate between months on the leaderboard page
- Latest available month is always the previous month
- Future months (including current) are not accessible

## Service-wide Statistics (`/api/stats/total`)

- Total places, reviews, users
- Tier distribution (pie chart)
- Category distribution (bar chart)
- Top 10 places by IMDB weighted rating
- Ranking formula explanation UI

## Monthly User Stats Update

When a review is created/deleted, `monthly_user_stats/{monthKey}/users/{uid}` is updated:
- `reviews`: +1 or -1
- `recordPoints`: +/- calculated points
- `tierCounts.{tier}`: +1 or -1
- `categoryReviews.{categoryKey}`: +1 or -1

## Admin Tools

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/check-monthly-data?month=YYYY-MM | Check if month data exists |
| POST | /api/admin/generate-leaderboard | Generate leaderboard for specific month |
| POST | /api/admin/trigger-snapshot | Manually trigger cron snapshot |
| POST | /api/admin/backfill-aggregates | Backfill monthly_user_stats from reviews |
