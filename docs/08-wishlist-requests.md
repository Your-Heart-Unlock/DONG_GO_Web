# Wishlist & Requests

## Wishlist

Users can bookmark places they want to visit.

### Flow
1. User clicks wish button on place detail
2. Creates wish document in `wishes` collection
3. Increments `wishCount` in `stats/{placeId}`
4. Duplicate check prevents multiple wishes for same place

### API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/wishes | member | Add wish |
| GET | /api/wishes?uid=&placeId= | member | Query wishes |
| DELETE | /api/wishes/[wishId] | member | Remove wish |

## Place Requests

Users can request place edits or deletions.

### Flow
1. User submits request (type: `place_delete` or `place_edit`)
2. Request saved with status `open`
3. Owner reviews in admin dashboard
4. Owner approves or rejects

### API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/requests | member | Create request |
| GET | /api/requests?status=&type= | owner | List requests |
| PATCH | /api/requests/[requestId] | owner | Approve/reject |
