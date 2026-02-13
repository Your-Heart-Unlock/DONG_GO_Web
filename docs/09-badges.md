# Badge System

## Overview

Badges are awarded automatically when users reach certain milestones.

## Badge Conditions

Defined in `badges` collection. Condition types:
- `review_count`: Total number of reviews
- `place_count`: Number of unique places registered
- `category_count`: Reviews in a specific category
- `tier_count`: Number of S/A/B/C/F ratings given

## Badge Check Flow

1. After review creation or place registration
2. `checkAndAwardBadges(uid)` called asynchronously
3. Checks all badge conditions against user's stats
4. Awards new badges to `user_badges/{uid}/badges/{badgeId}`
5. Failures don't block the main operation

## Representative Badge

Users can select one badge to display on their profile:
- Stored as `representativeBadgeId` in `users/{uid}`
- Updated via `/api/users/me/representative-badge`

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/badges/check | member | Manually trigger badge check |
| PATCH | /api/users/me/representative-badge | member | Set representative badge |
