# 서비스 확장 아이디어 (MVP 이후)

현재 MVP는 "맛집 기록 + 평가"의 핵심 기능에 집중되어 있습니다.
이 문서는 **폐쇄형 지인 커뮤니티**에 맞는 실용적 확장 아이디어를 담고 있습니다.

> **컨셉**: 외부 공유 NO, 우리끼리 셀럽 YES 🔥

---

## 🎯 Phase 1 - 핵심 기능 보강

### 1.1 "가고 싶어요" (위시리스트)
**목표**: 가고 싶은 장소를 북마크하고, 친구들의 관심도 파악

```typescript
// wish_visits 컬렉션
interface WishVisit {
  wishId: string;
  placeId: string;
  uid: string;
  createdAt: Date;
  note?: string; // "여기 스테이크 먹어보고 싶음"
}
```

// Firestore 구조
wishes/{wishId}
  - placeId
  - uid
  - createdAt
  - note (optional)

// API
POST /api/wishes
DELETE /api/wishes/{wishId}
GET /api/wishes?uid={uid} // 내 위시리스트
### 1.2 스마트 검색 & 필터 ⭐
**현재 문제**: 검색만 있고 필터가 없음
**목표**: 원하는 조건으로 빠르게 찾기

```typescript
// 고급 검색 쿼리
interface SearchQuery {
  keyword?: string; // 이름, 주소 검색
  categories?: string[]; // ["한식", "일식"]
  tiers?: RatingTier[]; // ["S", "A"]
  regions?: string[]; // ["강남", "홍대"] - 주소에서 추출
  minReviews?: number; // 리뷰 3개 이상만
  wishOnly?: boolean; // 내가 가고 싶어요 한 곳만
  unvisitedOnly?: boolean; // 내가 아직 안 가본 곳만
  sortBy?: 'recent' | 'rating' | 'reviews' | 'wishes';
}
```
// API
GET /api/search/places?category=한식&tier=S,A&sortBy=reviews


**UI 구현**:
```tsx
// SearchBar.tsx에 필터 버튼 추가
<div className="search-bar">
  <input placeholder="장소 검색..." />
  <button onClick={() => setShowFilters(true)}>
    🔍 필터 ({activeFilterCount})
  </button>
</div>

// FilterPanel.tsx (슬라이드 오버)
<SlideOver isOpen={showFilters}>
  <h3>필터</h3>
  
  {/* 카테고리 */}
  <FilterGroup label="카테고리">
    <Checkbox value="한식">한식 ({counts.한식})</Checkbox>
    <Checkbox value="일식">일식 ({counts.일식})</Checkbox>
    ...
  </FilterGroup>
  
  {/* 등급 */}
  <FilterGroup label="등급">
    <Chip color="purple">S ({counts.S})</Chip>
    <Chip color="blue">A ({counts.A})</Chip>
    ...
  </FilterGroup>
  
  {/* 지역 */}
  <FilterGroup label="지역">
    <Select>강남, 홍대, 신촌, 성수...</Select>
  </FilterGroup>
  
  {/* 기타 */}
  <Switch>내가 안 가본 곳만</Switch>
  <Switch>가고 싶어요 한 곳만</Switch>
  
  <Button>적용</Button>
  <Button variant="ghost">초기화</Button>
</SlideOver>
```

**지도 연동**:
- 필터 적용 시 지도 마커도 즉시 업데이트
- URL에 필터 상태 저장 (`?category=한식&tier=S`)
- 필터 프리셋 저장 (나중에)

---

## 🏆 Phase 2 - "우리끼리 셀럽" 시스템

### 2.1 개인 통계 대시보드
**페이지**: `/me/stats`

```typescript
interface UserStats {
  // 기본 통계
  totalReviews: number;
  totalPlacesVisited: number;
  averageTier: number; // 평균 평점 (S=5, A=4, ...)
  
  // 등급 분포
  tierBreakdown: {
    S: number;
    A: number;
    B: number;
    C: number;
    F: number;
  };
  
  // 카테고리 분석
  topCategories: { 
    category: string; 
    count: number;
    avgTier: number;
  }[];
  
  // 시간 분석
  reviewsByMonth: { month: string; count: number }[];
  mo� Phase 3 - 운영 & 관리

### 3.1 초대 시스템 (나중에)
**현재**: owner가 수동으로 pending → member 승급
**나중**: 클럽하우스 스타일 초대 코드

```typescript
// invites 컬렉션 (Phase 2 이후 구현)
interface Invite {
  inviteCode: string; // "ABC123XYZ"
  createdBy: string;
  maxUses: number; // 1회용
  usedCount: number;
  expiresAt: Date;
  usedBy: string[];
}

// 회원가입 시
/signup?invite=ABC123XYZ
```

**현재는**: 수동 승인으로 충분 (지인 3명만 사용)

### 3.2 전체 통계 페이지
**페이지**: `/stats` (모든 member 볼 수 있음)

```typescript
interface ServiceStats {
  totalPlaces: number;
  totalReviews: number;
  totalUsers: number;
  
  // 인기 장소 TOP 10
  topPlaces: Place[];
  
  // 카테고리별 분포
  categoryDistribution: { category: string, count: number }[];
  
  // 평가 분포
  tierDistribution: { tier: RatingTier, count: number }[];
  
  // 재미 통계
  mostReviewedPlace: Place;
  mostControversial: Place; // 평가 편차 큰 곳
  hiddenGem: Place; // 리뷰 적지만 S등급
}
```

**시각화**:
- "우리가 지금까지 {totalPlaces}곳을 발굴했습니다"
- 카테고리별 도넛 차트
- 등급별 분포 바 차트
**아이디어**: 내 취향 분석 → 추천

```typescript
// 사용자 취향 분석
function analyzeUserTaste(uid: string) {
  const reviews = getUserReviews(uid);
  
  // 선호 카테고리
  const categoryPreference = {};
  reviews.forEach(r => {
    categoryPreference[r.place.category] = 
      (categoryPreference[r.place.category] || 0) + 1;
  });
  
  // 선호 태그
  const tagPreference = {};
  reviews.forEach(r => {
    r.tags?.forEach(tag => {
      tagPreference[tag] = (tagPreference[tag] || 0) + 1;
    });
  });
  
  return { categoryPreference, tagPreference };
}

// 추천 알고리즘
function getRecommendations(uid: string) {
  const taste = analyzeUserTaste(uid);
  const unvisitedPlaces = getUnvisitedPlaces(uid);
  
  return unvisitedPlaces
    .map(place => ({
      ...place,
      score: calculateMatchScore(place, taste),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
```

**UI**:
- 홈 화면에 "OO님을 위한 추천" 섹션
- "비슷한 취향의 사람들이 좋아한 곳" 추천

### 3.2 스마트 검색 & 필터
**현재**: 기본 검색만 있음
**개선**:

```typescript
// 고급 검색 쿼리
interface SearchQuery {
  keyword?: string;
  categories?: string[];
  tiers?: RatingTier[];
  tags?: string[];
  location?: {
    lat: number;
    lng: number;
    radius: number; // km
  };
  priceRange?: 'low' | 'medium' | 'high';
  hasParking?: boolean;
  visitedBy?: string[]; // "친구가 다녀온 곳"
}

// Algolia 또는 Elasticsearch 사용 권장
// Firestore 단독으로는 복합 검색이 제한적
```

**필터 UI**:
- 지도 위 필터 패널 (슬라이드 오버)
- "카페만 보기", "S등급만", "10km 이내"
- 저장된 필터 프리셋

### 3.3 "근처 맛집 알림"
**아이디어**: 위치 기반 알림

```typescript
// PWA + Geolocation API
if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition(position => {
    const { latitude, longitude } = position.coords;
    
    // 근처 500m 이내 S등급 장소 체크
    const nearbyGems = checkNearbyPlaces(latitude, longitude, 0.5);
    
    if (nearbyGems.length > 0) {
      showNotification(
        '근처에 전파각 맛집이 있어요!',
        `${nearbyGems[0].name}이(가) 400m 거리에 있습니다.`
      );
    }
  });
}
```

**주의**: 배터리 소모, 권한 문제 → 옵트인 방식

---

## 📊 Phase 4 - 데이터 인사이트

### 4.1 개인 통계 대시보드
**페이지**: `/me/stats`

```typescript
interface UserInsights {
  // 요약
  totalPlacesVisited: number;
  totalReviews: number;
  averageTier: number;
  
  // 카테고리 분석
  topCategories: { name: string, count: number }[];
### 3.3 알림 시스템 (간단하게)
```typescript
// notifications 컬렉션
interface Notification {
  notificationId: string;
  uid: string;
  type: 'new_place' | 'friend_review' | 'rank_change';
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

// 예시
"동훈님이 새로운 장소를 추가했어요" → /places/{placeId}
"민지님이 리뷰를 작성했어요" → /places/{placeId}
"축하합니다! 2위로 올라갔어요 🎉" → /leaderboard
```

---

## 📱 Phase 4 - 편의 기능 (나중에)

### 4.1 PWA (앱처럼 사용)
- 홈 화면에 추가
- 오프라인 캐싱
- 빠른 로딩

### 4.2 사진 갤러리
- 장소별 모든 사진 보기
- 사진 크게 보기 (라이트박스)
- 사진으로만 필터링

### 4.3 메뉴 정보 (옵션)
```typescript
interface Menu {
  menuId: string;
  placeId: string;
  name: string;
  price: number;
  photos: string[];
}
```
// Service Worker
// - 오프라인 캐싱
// - 백그라운드 동기화
// - 푸시 알림
```

**효과**:
- 홈 화면에 추가 가능
- 앱처럼 실행
- 오프라인에서도 데이터 조회 (캐시)

### 7.2 알림 시스템
```typescript
// notifications 컬렉션
interface Notification {
  notificationId: string;
  uid: string;
  type: 'new_place' | 'friend_review' | 'badge_earned';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

// UI
<NotificationBell count={unreadCount}>
  <NotificationList />
</NotificationBell>
```

---

## 🎁 Phase 8 - 프리미엄 기능 (선택)

토큰 시스템 외에 프리미엄 기능 아이디어:

### 8.1 프리미엄 멤버십 (유료)
**주의**: 친목 서비스이므로 수익화는 신중하게

- 무제한 사진 업로드
- 고급 통계 & 인사이트
- 커스텀 테마
- 광고 없음 (광고가 있다면)

### 8.2 비즈니스 API
- 외부 앱에서 맛집 데이터 활용
- Read-only API 제공
- 공개 장소만 노출

---

## 🚀 구현 우선순위 제안

### Must Have (MVP 직후)
1. ✅ **공유하기** - 링크 공유, 클립보드 복사
2. ✅ **초대 시스템** - 친구 초대 관리
3. ✅ **개인 통계** - 내 활동 요약

### Should Have (1~2개월 내)
4. ✅ **스마트 검색** - 필터, 정렬
5. ✅ **위시리스트** - 가고 싶어요
6. ✅ **뱃지 시스템** - 가벼운 게이미피케이션

### Nice to Have (장기)
7. 루트 만들기
8. AI 기능
9. PWA
10. 메뉴 정보

---

## 💡 핵심 철학 유지

확장할 때도 이것만은 지키기:

1. **단순함**: 너무 많은 기능은 오히려 독
2. **신뢰**: 친구들끼리 공유하는 가치 유지
3. **프라이버시**: 원하지 않는 노출 방지
4. **속도**: 빠르고 가벼운 경험

---

## 📝 다음 단계

이 아이디어 중에서:
1. 가장 임팩트가 큰 것 선택
2. 간단한 프로토타입 제작
3. 실제 사용자 피드백 수집
4. 반복 개선

**질문**:
- 어떤 기능이 가장 매력적인가요?
- 사용자들이 가장 원할 것 같은 기능은?
- 구현 난이도 vs 효과를 고려한 우선순위는?
---

## 🚀 구현 우선순위

### ⭐ P0 - MVP 직후 즉시 (1주)
1. **스마트 필터** (2일) - 카테고리/등급/지역 필터
2. **위시리스트** (1.5일) - "가고 싶어요" 버튼 + 내 위시리스트 페이지
3. **개인 통계** (2일) - 기본 대시보드 + 등급 분포 차트

### 🎯 P1 - 핵심 재미 요소 (2주)
4. **리더보드** (2일) - 점수 계산 + 랭킹 UI
5. **뱃지 시스템** (1일) - 6개 기본 뱃지
6. **전체 통계** (1일) - 서비스 통계 페이지

### 💡 P2 - 편의 기능 (나중에)
7. 초대 시스템 (지금은 수동 관리)
8. 알림 시스템
9. PWA
10. 메뉴 정보

---

## 💡 핵심 철학

폐쇄형 지인 커뮤니티에 맞게:

1. **폐쇄성**: 외부 공유 기능 NO, 우리끼리만
2. **경쟁 & 재미**: 리더보드와 통계로 "셀럽" 만들기
3. **실용성**: 필터로 빠르게 찾고, 위시리스트로 관리
4. **단순함**: 복잡한 AI/추천 시스템 대신 명확한 기능

---

## 📝 다음 작업

1. CHECKLIST.md에 Phase 1~2 항목 추가
2. 스마트 필터부터 구현 시작
3. 각 기능별로 IMPL 문서 작성 필요시

**추정 소요 시간**: 
- Phase 1 (P0): 약 5일
- Phase 2 (P1): 약 4일
- **총 MVP → v1.0**: 약 2주