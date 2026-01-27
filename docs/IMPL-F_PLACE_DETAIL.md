# F. 장소 상세 페이지 (B 정책)

## 목표
pending/guest는 통계만, member/owner는 리뷰/방문/사진 접근

## 구현 완료 ✅

### 1. 기본 정보 표시
**파일**: `app/places/[placeId]/page.tsx`
- place 문서 조회: `getPlaceById(placeId)`
- 이름, 주소, 카테고리, 네이버 지도 링크

### 2. stats 통계 표시 (모든 역할)
```tsx
const stats = await getPlaceStats(placeId);

<div>
  <p>리뷰 수: {stats.reviewCount}</p>
  <p>최다 등급: {getTopTier(stats.tierCounts)}</p>
</div>
```

### 3. member/owner 전용 섹션
```tsx
{isMemberOrOwner ? (
  <>
    <ReviewList placeId={placeId} />
    {/* 방문 기록: 미구현 */}
    {/* 사진 갤러리: UI만 */}
  </>
) : (
  <div>🔒 멤버 전용 콘텐츠</div>
)}
```

### 4. 리뷰 리스트
**파일**: `components/reviews/ReviewList.tsx`
- `getReviewsByPlaceId(placeId)` 호출
- ReviewCard 컴포넌트로 개별 리뷰 표시
- 리뷰 작성/수정/삭제 (본인만)

### 5. pending/guest 잠금 UI
- "🔒 이 장소의 상세 리뷰는 멤버 전용입니다"
- pending: "승인 대기 중" 안내
- guest: "로그인하기" 링크

## 미구현 항목 ⚠️

### 1. 방문 기록 표시
**목표**: reviews 데이터의 방문 정보 표시

**현재 상태**: reviews에 visitedAt, companions, revisitIntent가 포함되어 있음

**구현 방법**: ReviewList 컴포넌트에서 표시하거나,
별도의 VisitList 컴포넌트를 만들어 방문 정보만 필터링하여 표시

```typescript
// 예시: 방문 정보가 있는 리뷰만 필터링
const visitsData = reviews.filter(r => r.visitedAt);
```

### 2. 사진 갤러리 (업로드 미구현)
**목표**: Firebase Storage에서 사진 로드 및 표시

**구현 필요**:
- Storage 경로: `places/{placeId}/photos/{photoId}`
- 썸네일 생성 (Cloud Functions 또는 클라이언트)
- 갤러리 UI: 그리드 레이아웃, 라이트박스

### 3. 지도 링크 동적 처리
**목표**: placeId 출처에 따라 네이버 또는 카카오 지도 링크

**현재**: 모든 장소에 네이버 지도 링크
**개선**:
```tsx
const mapUrl = place.placeId.startsWith('kakao_')
  ? `https://place.map.kakao.com/${place.placeId.replace('kakao_', '')}`
  : `https://map.naver.com/p/entry/place/${place.placeId}`;
```

또는 places 문서에 `mapProvider` 필드 추가:
```typescript
interface Place {
  // ...
  mapProvider: 'naver' | 'kakao';
  kakaoPlaceUrl?: string;
}
```

## 체크포인트
- [x] 기본 정보 및 stats 표시
- [x] member/owner만 리뷰 리스트 표시
- [x] pending/guest 잠금 UI
- [ ] 방문 기록 표시
- [ ] 사진 갤러리 (Storage 연동)
- [ ] 지도 링크 동적 처리

## 참고 문서
- [REF_USER_EXPERIENCE.md](REF_USER_EXPERIENCE.md) - B 정책 상세
- [IMPL-H_REVIEW_VISIT.md](IMPL-H_REVIEW_VISIT.md) - 리뷰/방문 시스템
- [02_DATA_MODEL.md](02_DATA_MODEL.md) - places, stats 스키마
