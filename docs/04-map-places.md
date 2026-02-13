# Map & Places

## Map Integration

Uses Naver Maps API via `useNaverMaps` hook. Places are loaded based on the visible map bounds using S2 cell IDs.

### Cell ID System
- Map area divided into cells of ~1.1km (CELL_SIZE = 0.01 degrees)
- `computeCellId(lat, lng)` returns `"{cellLat}_{cellLng}"`
- Places queried by `cellId` for efficient bounds-based loading

### Geohash System
- 9-character geohash for proximity search (duplicate detection)
- Places within 100m of each other flagged as potential duplicates

## Place CRUD

### Adding Places
1. User searches via Naver/Kakao API (`/api/search/naver-resolve`, `/api/search/kakao-resolve`)
2. Search results matched against existing places by `naverPlaceId` or `kakaoPlaceId`
3. If no match, new place created with auto-generated `cellId`, `geohash`, `categoryKey`
4. Badge check triggered after place creation

### Place Status
- `active`: Visible on map
- `hidden`: Hidden by admin (still in DB)
- `deleted`: Soft-deleted

### Categories
11 standardized categories:
Korea, China, Japan, West, Asian, Snack, Meat, Sea, Cafe, Beer, Other

Category assigned via `inferCategoryKey(categoryName)` which maps Korean text to CategoryKey.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/places/all | - | All active places |
| GET | /api/places/filter | - | Filter by category/tier |
| GET | /api/places/search | - | Text search |
| GET | /api/places/[placeId] | - | Single place detail |
| POST | /api/places/[placeId]/photos | member | Upload photo |
| GET | /api/places/[placeId]/photos | - | List photos |
