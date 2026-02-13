# Admin System

## Admin Dashboard (`/admin`)

Owner-only page with:
1. **Dashboard stats**: Total places, reviews, pending users, open requests
2. **User management**: View all users, change roles (pending -> member -> owner)
3. **Monthly data tools**: Check/generate leaderboards for specific months
4. **Migration tools**: One-time data migration endpoints

## Admin API Endpoints

All admin endpoints require `owner` role via `requireOwner()`.

### User Management
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/users | List all users |
| PATCH | /api/admin/users/[uid] | Change user role |
| POST | /api/admin/sync-users | Sync Firebase Auth -> Firestore users |

### Place Management
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/places | List places (paginated, filterable) |
| PATCH | /api/admin/places/categories | Batch update categories |
| POST | /api/admin/places/categories | Cleanup/auto-assign categories |

### Review Management
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/reviews | List all reviews (paginated) |

### Data Import
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/admin/import | Bulk import places from CSV |

### Statistics & Leaderboard
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/admin/stats | Dashboard summary stats |
| GET | /api/admin/check-monthly-data | Check monthly data existence |
| POST | /api/admin/generate-leaderboard | Generate leaderboard for month |
| POST | /api/admin/trigger-snapshot | Manually trigger monthly snapshot |
| POST | /api/admin/backfill-aggregates | Backfill monthly stats from reviews |

### Migrations (One-time)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/admin/migrate-cellid | Add cellId field to all places |
| POST | /api/admin/migrate-geohash | Add geohash field to all places |
| POST | /api/admin/migrate-registrants | Set createdBy for imported places |

## Admin Logging

All admin actions are logged to `admin_logs` collection:
```
{
  action: 'UPDATE_USER_ROLE' | 'IMPORT_PLACES' | 'BATCH_UPDATE_CATEGORIES' | ...
  performedBy: uid,
  metadata: { ... },
  createdAt: Timestamp
}
```
