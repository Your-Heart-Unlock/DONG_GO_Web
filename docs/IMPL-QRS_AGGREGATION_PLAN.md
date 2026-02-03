# IMPL-QRS Aggregation Plan (Monthly Leaderboard / Badges / Stats)

This document defines the **aggregation-first** implementation plan for:
- **Q**: Monthly Hall of Fame (leaderboard)
- **R**: Badge system
- **S**: Service stats page

Goal: **avoid Firestore read explosions** by using **event-driven counters + monthly snapshots**.

---

## 0) Final decisions (locked)

- Timezone / period: **Asia/Seoul**, monthly windows (`YYYY-MM-01 00:00:00` ~ `YYYY-MM-last 23:59:59`)
- Leaderboard: **monthly only**
- Titles: **all titles public**, but each user can **hide themselves** from public boards
- Category title: **per category, monthly #1 only**
- Place-add score: **approved places only**
- “Record King” scoring:
  - visit record field completion points:
    - visitedAt: +1
    - oneLineReview (>= 20 chars): +1
    - revisitIntent set: +1
    - companions set: +1
    - **photos: +2**
- Reviews: **multiple reviews per user per place allowed**
- Photos: count includes photos attached to reviews (and/or visit records if you support both)

---

## 1) What must be precomputed (no on-demand scanning)

UI pages must read only:
- `monthly_leaderboard/{YYYY-MM}` (top lists + title winners)
- `monthly_service_stats/{YYYY-MM}` (distribution + popular places)
- optional: `monthly_user_rank/{YYYY-MM}/{uid}` (for “my rank”, if you want exact rank beyond top N)

Never compute leaderboards by scanning all reviews.

---

## 2) Collections & documents

### 2.1 Canonical inputs (existing)
Assumed collections (adapt names to your project):
- `places/{placeId}`
- `reviews/{reviewId}`
- `users/{uid}` (profile, nickname, etc.)

### 2.2 Aggregates (new)

#### A) Per-user lifetime stats
`user_stats/{uid}`
- counts:
  - totalReviews
  - totalPhotos
  - totalApprovedPlacesAdded
  - tierCounts: {S,A,B,C,F,N}
- derived:
  - avgTierScore (optional)
  - lastActiveAt
- privacy:
  - hideFromLeaderboard: boolean (default false)

#### B) Per-place lifetime stats
`place_stats/{placeId}`
- totalReviews
- totalPhotos
- tierCounts: {S,A,B,C,F,N}
- avgTierScore (optional)
- lastReviewAt

#### C) Per-user monthly stats (the workhorse)
`monthly_user_stats/{YYYY-MM}/{uid}`
- month: "YYYY-MM"
- counts:
  - reviews
  - photos
  - approvedPlacesAdded
  - recordPoints   // “Record King” points sum
  - categoryReviews: {Korea,China,Japan,West,Asian,Snack,Meat,Sea,Cafe,Beer,Other,Idle}
  - tierCounts: {S,A,B,C,F,N}
- derived:
  - score_total (for overall leaderboard)
  - score_record (for record king)
  - score_photos (for photo king)
  - score_reviews (for review king)
  - score_adds (for place add king)
- lastActiveAt

#### D) Monthly leaderboard snapshot (single doc)
`monthly_leaderboard/{YYYY-MM}`
- generatedAt
- top:
  - reviewKingTop: [{uid, value}...]  // value = reviews
  - recordKingTop: [{uid, value}...]  // value = recordPoints
  - photoKingTop:  [{uid, value}...]  // value = photos
  - addKingTop:    [{uid, value}...]  // value = approvedPlacesAdded
  - overallTop:    [{uid, value}...]  // value = score_total
- categoryWinners:
  - Korea: {uid, value}
  - China: {uid, value}
  - ...
- meta:
  - hiddenCount (how many users filtered out)
  - eligibilityRuleVersion

#### E) Monthly service stats snapshot (single doc)
`monthly_service_stats/{YYYY-MM}`
- generatedAt
- totals:
  - totalReviews
  - totalPhotos
  - totalApprovedPlacesAdded
  - activeUsers
- distributions:
  - tierCounts: {S,A,B,C,F,N}
  - categoryCounts: {Korea,China,Japan,West,Asian,Snack,Meat,Sea,Cafe,Beer,Other,Idle}
- popularPlaces:
  - topReviewed: [{placeId, value}...]  // value = review count
  - topRated: [{placeId, value}...]     // optional: avgTierScore (requires score model)
- notes:
  - calculationVersion

---

## 3) Scoring (simple & anti-farm)

Use separate scores per title, and optional “overall score”.

### 3.1 Title metrics (locked)
- Review King: `monthly_user_stats.reviews`
- Photo King: `monthly_user_stats.photos`
- Add King: `monthly_user_stats.approvedPlacesAdded`  (only when place is approved)
- Record King: `monthly_user_stats.recordPoints`

### 3.2 Record points details (locked)
Each “visit record” (or review metadata) contributes:
- visitedAt present: +1
- oneLineReview length >= 20: +1
- revisitIntent set: +1
- companions set (non-empty): +1
- photosCount > 0: **+2**

> Implementation tip: compute points per review/visit at write-time and store `recordPointsDelta` on that event doc to support edits.

### 3.3 Optional overall score (suggested)
`score_total = reviews*10 + photos*2 + approvedPlacesAdded*20 + recordPoints`
But you can omit “overallTop” at MVP if not needed.

> Place-add points can feel farmable. Since you only count approved places, that’s already a strong brake.

---

## 4) Event-driven updates (Cloud Functions / server actions)

### 4.1 On review created
Trigger: `reviews/{reviewId}` onCreate
Update (transaction or batched writes):
1) `user_stats/{uid}`
   - totalReviews += 1
   - totalPhotos += photosCount
   - tierCounts[tier] += 1
   - lastActiveAt = now
2) `place_stats/{placeId}`
   - totalReviews += 1
   - totalPhotos += photosCount
   - tierCounts[tier] += 1
   - lastReviewAt = now
3) `monthly_user_stats/{YYYY-MM}/{uid}`
   - reviews += 1
   - photos += photosCount
   - tierCounts[tier] += 1
   - categoryReviews[categoryKey] += 1   // categoryKey from place at time of review (see 4.4)
   - recordPoints += computedRecordPoints
   - lastActiveAt = now

### 4.2 On review updated
Trigger: onUpdate
- If tier changed: adjust tierCounts deltas in user/place/monthly docs
- If photosCount changed: adjust totalPhotos/photos in user/place/monthly docs
- If record fields changed: adjust recordPoints by delta
- If placeId changed (should be disallowed): ignore or treat as delete+create

### 4.3 On review deleted
Trigger: onDelete
- Reverse the same counters (requires that the deleted review payload includes tier/photos/recordPoints/categoryKey snapshot)
- If you cannot guarantee full payload on delete, store `review_aggregate_snapshot` in the review document at creation time.

### 4.4 Category key source for category leaderboards
To keep monthly category winner consistent even if categories are edited later:
- At review creation, snapshot `placeCategoryKeyAtReview`
- Use that snapshot for `categoryReviews` increments
- Do NOT recompute all past reviews when a place category changes

### 4.5 On place created (unapproved)
No score updates yet.

### 4.6 On place approved
Trigger: `places/{placeId}` onUpdate where `approvedAt` transitions null -> timestamp
- Determine `createdByUid`
- Update:
  - `user_stats/{uid}` totalApprovedPlacesAdded += 1
  - `monthly_user_stats/{YYYY-MM}/{uid}` approvedPlacesAdded += 1
  - lastActiveAt = now (optional)

> If approvals can happen later (different month than created), count in the month of approval (simplest).

### 4.7 Hide-from-leaderboard toggle
When user sets `hideFromLeaderboard = true` in `user_stats/{uid}`:
- No need to recompute counters; it is applied during snapshot generation (cron).
- Optionally add a “you are hidden” badge state in UI.

---

## 5) Monthly snapshot job (cron)

### 5.1 When
MVP recommendation:
- Run **daily** at a quiet time (e.g., 03:10 KST) and overwrite snapshots.

### 5.2 What it does
Inputs:
- `monthly_user_stats/{YYYY-MM}/*`
- `user_stats/*` (only to filter hidden users)

Outputs:
- `monthly_leaderboard/{YYYY-MM}`:
  - top lists for each metric (top 10~20)
  - category winners: per category key pick max `categoryReviews[key]`
- `monthly_service_stats/{YYYY-MM}`:
  - totals and distributions
  - popular places top lists (optionally from `place_stats`)

Recommended hybrid:
- Maintain `monthly_totals/{YYYY-MM}` incrementally for totals, so snapshot job is O(1) for totals.

---

## 6) Badge system (R)

### 6.1 Badge definition storage
Static JSON or `badges` collection:
- id, name, description, iconKey, rarity, rule

### 6.2 Awarding strategy
- Award badges **based on aggregates**, not by scanning reviews.
- Trigger awarding on:
  - review create/update
  - place approved
  - monthly snapshot job (for monthly titles)

### 6.3 Where to store user badges
`user_badges/{uid}`
- earned: [{badgeId, earnedAt, contextMonth?}]
- featuredBadgeIds: string[] (max 3)

### 6.4 Monthly titles as badges
Monthly winners get badge:
- `MONTHLY_REVIEW_KING_YYYY_MM`
- `MONTHLY_RECORD_KING_YYYY_MM`
- etc.

Category title winners:
- `MONTHLY_CATEGORY_KING_{CategoryKey}_YYYY_MM`

---

## 7) Stats page (S)

UI reads:
- `monthly_service_stats/{YYYY-MM}` (default to current month)
- optionally all-time stats doc: `service_stats/all_time`

Show:
- active users
- total reviews/photos
- category distribution
- tier distribution
- popular places top 10

---

## 8) Indexes (Firestore)

If stored as subcollection (`monthly_user_stats/{YYYY-MM}/{uid}`), you will query within that month scope.

Suggested indexes within each month scope:
- order by `reviews` desc
- order by `photos` desc
- order by `recordPoints` desc
- order by `approvedPlacesAdded` desc
- order by `score_total` desc (if used)

---

## 9) Safety / anti-abuse

- Optional rate limit: max X reviews per place per day per user (to reduce spam)
- Place-add points only on approval: locked
- Hide-from-leaderboard toggle: locked
- Optional minimum sample thresholds for spicy titles (if you add them later)

---

## 10) Implementation checklist

### Build aggregates
- [ ] Create collections: `user_stats`, `place_stats`, `monthly_user_stats`, `monthly_leaderboard`, `monthly_service_stats`
- [ ] Add `hideFromLeaderboard` setting in UI
- [ ] Ensure places have `approvedAt`, `createdByUid`, and `categoryKey`

### Triggers
- [ ] review onCreate updates aggregates
- [ ] review onUpdate applies deltas
- [ ] review onDelete reverses deltas
- [ ] place approval increments approved add counters

### Snapshot jobs
- [ ] daily monthly leaderboard generator
- [ ] daily monthly service stats generator

### UI
- [ ] `/hall-of-fame` reads `monthly_leaderboard/{YYYY-MM}`
- [ ] `/stats` reads `monthly_service_stats/{YYYY-MM}`
- [ ] profile shows badges + hide toggle

---

## 11) Placeholders / adaptions

- Replace collection names with your actual schema.
- If photos are stored separately, adapt `photosCount` computation.
- If tier labels map to numeric values, define that mapping in one place and reuse.

