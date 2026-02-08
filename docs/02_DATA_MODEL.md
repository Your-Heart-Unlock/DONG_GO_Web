# Data Model (Firestore)

## users/{uid}
- email (string) - 로그인 이메일
- nickname (string) - 표시용 닉네임
- role: owner | member | pending
- createdAt (Timestamp)
- lastLoginAt (Timestamp)

## places/{placeId}
(placeId = 네이버 또는 카카오 지도 고유 ID)
- name (string)
- address (string)
- lat (number)
- lng (number)
- category (string) - UI 표시용 (예: "음식점", "카페")
- categoryCode (string, optional) - 필터링용 코드
- categoryKey (string, optional) - 카테고리 아이콘용 (예: "Korea")
- createdBy (string) - uid
- createdAt (Timestamp)
- updatedAt (Timestamp, optional)
- source: naver_import | user_added
- status: active | hidden | deleted
- mapProvider (string, optional) - 'naver' | 'kakao', 등록 시 사용된 검색 제공자
- naverPlaceId (string, optional) - 네이버 지도 상세 페이지용 ID (순수 숫자)
- kakaoPlaceId (string, optional) - 카카오 지도 상세 페이지용 ID (순수 숫자)
- cellId (string, optional) - 지도 그리드 인덱스 (REF_MAP_STRATEGY.md 참고)
- geohash (string, optional) - 좌표 기반 검색용 인덱스

## reviews/{reviewId}
**주의**: 방문 정보(visitedAt, companions, revisitIntent)도 여기 포함됨
- placeId (string)
- uid (string)
- ratingTier: S | A | B | C | F
- oneLineReview (string, optional) - 한줄평
- tags (string[], optional) - 태그 배열
- visitedAt (Timestamp, optional) - 방문 날짜
- companions (string, optional) - 동행자
- revisitIntent (boolean, optional) - 재방문 의사
- createdAt (Timestamp)
- updatedAt (Timestamp, optional)

## stats/{placeId}
장소별 통계 (reviews 기반 자동 계산)
- reviewCount (number)
- tierCounts (object) - { S: 0, A: 0, B: 0, C: 0, F: 0 }
- topTags (string[]) - 빈도 상위 5개 태그

## requests/{requestId}
장소 수정/삭제 요청 (미구현)
- type: place_edit | place_delete
- placeId (string)
- requestedBy (string) - uid
- payload (object) - diff 데이터
- status: open | approved | rejected
- createdAt (Timestamp)
- resolvedAt (Timestamp, optional)
- resolvedBy (string, optional) - uid

## admin_logs/{logId}
관리자 작업 로그
- action (string) - 작업 유형
- performedBy (string) - uid
- metadata (object) - 작업 세부 정보
- createdAt (Timestamp)

## config/ratings
평점 라벨 설정 (미구현)
- tiers (object) - 각 tier별 라벨 정의
- updatedAt (Timestamp)
- updatedBy (string) - uid

---

## 미구현 컬렉션

### visits/{visitId} (deprecated)
**방문 정보는 reviews에 통합됨**. 별도 컬렉션으로 분리하지 않음.

### place_markers/{placeId} (planned)
지도 렌더링 최적화를 위한 경량 컬렉션. 필요 시 구현 예정.
