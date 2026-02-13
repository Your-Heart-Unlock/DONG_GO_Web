# Data Model

## Firestore Collections

### `users/{uid}`
| Field | Type | Description |
|-------|------|-------------|
| email | string | Google email |
| nickname | string | Display name |
| role | 'pending' \| 'member' \| 'owner' | User role |
| representativeBadgeId | string? | Selected badge to display |
| createdAt | Timestamp | Account creation |
| lastLoginAt | Timestamp | Last login |

### `places/{placeId}`
| Field | Type | Description |
|-------|------|-------------|
| name | string | Restaurant name |
| address | string | Full address |
| lat / lng | number | Coordinates |
| category | string | Category label (Korean) |
| categoryKey | CategoryKey | Standardized key (Korea, China, Japan, etc.) |
| source | string | Data source (naver_import, manual, etc.) |
| status | 'active' \| 'hidden' \| 'deleted' | Visibility |
| mapProvider | string | 'naver' \| 'kakao' |
| naverPlaceId | string? | Naver place ID |
| kakaoPlaceId | string? | Kakao place ID |
| cellId | string | S2 cell ID for map grid queries |
| geohash | string | Geohash for proximity search |
| createdBy | string | Creator's uid |
| createdAt | Timestamp | Creation date |

### `reviews/{reviewId}`
| Field | Type | Description |
|-------|------|-------------|
| placeId | string | Target place |
| uid | string | Reviewer's uid |
| ratingTier | RatingTier | S, A, B, C, or F |
| oneLineReview | string? | Short text review |
| tags | string[] | Review tags |
| visitedAt | Timestamp? | Visit date |
| revisitIntent | boolean? | Would revisit |
| companions | string? | Who they went with |
| createdAt | Timestamp | Review creation |

### `stats/{placeId}` (Place Statistics)
| Field | Type | Description |
|-------|------|-------------|
| reviewCount | number | Total reviews |
| tierCounts | Record<RatingTier, number> | Count per tier |
| topTags | string[] | Most used tags |
| reviewerUids | string[] | Reviewer UIDs |
| wishCount | number | Wish count |

### `wishes/{wishId}`
| Field | Type | Description |
|-------|------|-------------|
| placeId | string | Target place |
| uid | string | User's uid |
| note | string? | Optional note |
| createdAt | Timestamp | Creation date |

### `photos/{photoId}`
| Field | Type | Description |
|-------|------|-------------|
| placeId | string | Target place |
| url | string | Public Storage URL |
| fileName | string | Stored file name |
| uploadedBy | string | Uploader's uid |
| uploadedAt | Timestamp | Upload date |

### `requests/{requestId}`
| Field | Type | Description |
|-------|------|-------------|
| type | 'place_delete' \| 'place_edit' | Request type |
| placeId | string | Target place |
| requestedBy | string | Requester's uid |
| payload | object? | Additional data |
| status | 'open' \| 'approved' \| 'rejected' | Status |
| createdAt | Timestamp | Creation date |
| resolvedAt | Timestamp? | Resolution date |
| resolvedBy | string? | Resolver's uid |

### `badges/{badgeId}`
| Field | Type | Description |
|-------|------|-------------|
| name | string | Badge name |
| description | string | Requirements description |
| icon | string | Icon identifier |
| conditionType | string | Condition type |
| conditionValue | number | Required value |

### `user_badges/{uid}/badges/{badgeId}`
| Field | Type | Description |
|-------|------|-------------|
| awardedAt | Timestamp | Award date |

### Monthly Aggregation Collections

#### `monthly_user_stats/{monthKey}/users/{uid}`
| Field | Type | Description |
|-------|------|-------------|
| month | string | YYYY-MM |
| uid | string | User ID |
| reviews | number | Review count for month |
| recordPoints | number | Record points for month |
| tierCounts | Record<RatingTier, number> | Tier distribution |
| categoryReviews | Record<CategoryKey, number> | Per-category counts |
| lastActiveAt | Timestamp | Last activity |

#### `monthly_leaderboard/{monthKey}`
| Field | Type | Description |
|-------|------|-------------|
| month | string | YYYY-MM |
| generatedAt | Timestamp | Generation time |
| reviewKingTop | LeaderboardEntry[] | Top 10 by reviews |
| recordKingTop | LeaderboardEntry[] | Top 10 by record points |
| overallTop | LeaderboardEntry[] | Top 10 combined |
| categoryWinners | Record<CategoryKey, CategoryWinner> | Per-category champions |
| hiddenCount | number | Hidden entries |

#### `monthly_service_stats/{monthKey}`
| Field | Type | Description |
|-------|------|-------------|
| month | string | YYYY-MM |
| totals | object | totalReviews, activeUsers, totalPlaces |
| distributions | object | tierCounts, categoryCounts |
| topReviewedPlaces | array | Top places by review count |

## Type Definitions

### CategoryKey
```
'Korea' | 'China' | 'Japan' | 'West' | 'Asian' | 'Snack' | 'Meat' | 'Sea' | 'Cafe' | 'Beer' | 'Other'
```

### RatingTier
```
'S' | 'A' | 'B' | 'C' | 'F'
```

### UserRole
```
'pending' | 'member' | 'owner'
```
