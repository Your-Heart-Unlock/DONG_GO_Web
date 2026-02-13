# API Reference

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer <firebase-id-token>
```

## Public Endpoints (No auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/places/all | All active places |
| GET | /api/places/filter | Filter places |
| GET | /api/places/search | Search places |
| GET | /api/places/[placeId] | Place detail + stats |
| GET | /api/places/[placeId]/photos | Place photos |
| GET | /api/search/places | Full-text place search |
| GET | /api/search/naver-resolve | Resolve Naver place |
| GET | /api/search/kakao-resolve | Resolve Kakao place |
| GET | /api/stats/total | Service statistics |
| GET | /api/users/[uid] | Public user profile |

## Member Endpoints (member or owner)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/me/reviews | My reviews (paginated) |
| GET | /api/me/stats | My statistics |
| POST | /api/wishes | Add to wishlist |
| GET | /api/wishes | Query wishes |
| DELETE | /api/wishes/[wishId] | Remove wish |
| POST | /api/requests | Create edit/delete request |
| POST | /api/places/[placeId]/photos | Upload photo |
| GET | /api/photos | All photos (paginated) |
| POST | /api/badges/check | Check for new badges |
| PATCH | /api/users/me/representative-badge | Set display badge |

## Owner Endpoints (owner only)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/stats | Dashboard stats |
| GET | /api/admin/users | All users |
| PATCH | /api/admin/users/[uid] | Change user role |
| GET | /api/admin/places | Places (paginated) |
| PATCH | /api/admin/places/categories | Batch update categories |
| POST | /api/admin/places/categories | Cleanup/auto-assign |
| GET | /api/admin/reviews | All reviews |
| POST | /api/admin/import | Bulk import |
| GET | /api/admin/check-monthly-data | Check monthly data |
| POST | /api/admin/generate-leaderboard | Generate leaderboard |
| POST | /api/admin/trigger-snapshot | Trigger cron manually |
| POST | /api/admin/backfill-aggregates | Backfill stats |
| POST | /api/admin/sync-users | Sync Auth -> Firestore |
| POST | /api/admin/migrate-cellid | Migration: add cellId |
| POST | /api/admin/migrate-geohash | Migration: add geohash |
| POST | /api/admin/migrate-registrants | Migration: set createdBy |
| GET | /api/requests | List requests |
| PATCH | /api/requests/[requestId] | Approve/reject request |

## Cron Endpoints

| Method | Path | Schedule | Description |
|--------|------|----------|-------------|
| POST | /api/cron/monthly-snapshot | Daily 18:10 UTC | Update leaderboard + service stats |

Authentication via `CRON_SECRET` environment variable.
