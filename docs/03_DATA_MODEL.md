# Data Model (Firestore)

## users/{uid}
- nickname (string)
- role: owner | member | pending
- createdAt
- lastLoginAt

## places/{placeId}
(placeId = 네이버 지도 고유 ID)
- name
- address
- lat, lng
- category
- createdBy
- createdAt
- source: naver_import | user_added
- status: active | hidden | deleted

## visits/{visitId}
- placeId
- uid
- visitedAt (date)
- companions (string, optional)
- revisitIntent (boolean or enum)
- createdAt

## reviews/{reviewId}
- placeId
- uid
- ratingTier: S | A | B | C | F
- oneLineReview (optional)
- tags (string[])
- createdAt
- updatedAt

## requests/{requestId}
- type: place_edit | place_delete
- placeId
- requestedBy
- payload (diff)
- status: open | approved | rejected
- createdAt
- resolvedAt
- resolvedBy

## places/{placeId}/stats
- reviewCount
- visitCount
- tierCounts { S, A, B, C, F }
- topTags[]
