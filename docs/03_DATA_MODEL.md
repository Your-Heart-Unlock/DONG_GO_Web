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
- cellId (string, 지도 그리드 인덱스 — 14_MAP_MARKER_STRATEGY 참고)

## place_markers/{placeId}
(지도 렌더링용 경량 컬렉션 — 14_MAP_MARKER_STRATEGY 참고)
- lat, lng
- cellId
- name
- category
- regionKey (optional)
- updatedAt

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
