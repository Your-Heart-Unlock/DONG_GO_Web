# H. 리뷰/방문 작성/편집

## 목표
리뷰 + 방문 기록 + 사진 업로드 시스템 구현

## 구현 완료 ✅

### 1. 리뷰 작성 컴포넌트
**파일**: `components/reviews/ReviewForm.tsx`
- 등급 선택: S(전파각), A(동네강자), B(평타), C(땜빵), F(지뢰)
- 한줄평 입력 (200자)
- 태그 입력 (쉼표 구분)
- 방문일 선택 (선택)
- 동행자 입력 (선택)
- 재방문 의사 (true/false/undefined)

### 2. 리뷰 저장 로직
**파일**: `lib/firebase/reviews.ts` - `createReview()`
```typescript
await addDoc(collection(db, 'reviews'), {
  placeId,
  uid,
  ratingTier,
  oneLineReview,
  tags,
  visitedAt,
  companions,
  revisitIntent,
  createdAt: serverTimestamp(),
});

// stats 자동 업데이트
await recalculateStats(placeId);
```

### 3. stats 재계산
**파일**: `lib/firebase/reviews.ts` - `recalculateStats()`
- 모든 리뷰 조회
- tierCounts: { S: 3, A: 5, B: 2, C: 0, F: 0 }
- topTags: 빈도 상위 5개
- reviewCount: 총 리뷰 수
- `stats/{placeId}` 문서 업데이트

### 4. 리뷰 수정/삭제
**파일**: `lib/firebase/reviews.ts`
- `updateReview(reviewId, updates)`: 본인만 가능
- `deleteReview(reviewId, placeId)`: 본인만 가능
- UI에서 `user.uid === review.uid` 체크

**UI**: `components/reviews/ReviewCard.tsx`
```tsx
{isOwn && (
  <button onClick={() => onEdit(review)}>수정</button>
  <button onClick={() => handleDelete()}>삭제</button>
)}
```

## 미구현 항목 ⚠️

### 1. 방문 기록 작성
**현재 상태**: 방문 정보(visitedAt, companions, revisitIntent)는 **reviews에 통합됨**

**분리가 필요한 경우**:
- 방문만 하고 평가는 안 할 때
- 한 장소를 여러 번 방문한 기록을 별도로 관리할 때

**구현 방법** (선택사항):

```typescript
// lib/firebase/visits.ts
export async function createVisit(visit: {
  placeId: string;
  uid: string;
  visitedAt: Date;
  companions?: string;
  photos?: string[];
}) {
  await addDoc(collection(db, 'visits'), {
    ...visit,
    createdAt: serverTimestamp(),
  });
}
```

**주의**: 현재 MVP에서는 reviews에 부분 필드로 충분함

### 2. 사진 업로드 (Firebase Storage)
**목표**: 사진 업로드 및 메타데이터 저장

**Storage 경로**:
```
places/
  {placeId}/
    photos/
      {photoId}.jpg
```

**구현 단계**:
1. 파일 선택 input
   ```tsx
   <input type="file" accept="image/*" multiple onChange={handleUpload} />
   ```

2. Storage 업로드
   ```typescript
   import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
   
   const storageRef = ref(storage, `places/${placeId}/photos/${photoId}`);
   await uploadBytes(storageRef, file);
   const url = await getDownloadURL(storageRef);
   ```

3. 메타데이터 저장
   ```typescript
   // photos 서브컬렉션 또는 visits 문서 내 배열
   await addDoc(collection(db, 'photos'), {
     placeId,
     uid,
     url,
     uploadedAt: serverTimestamp(),
   });
   ```

4. Storage Rules 확인
   ```javascript
   // storage.rules
   match /places/{placeId}/photos/{photoId} {
     allow read: if request.auth != null;
     allow write: if request.auth != null 
                  && getUserRole(request.auth.uid) in ['member', 'owner'];
   }
   ```

### 3. visitCount 통계
**현재**: stats에 reviewCount만 있음
**추가 필요**: visitCount

**구현**:
```typescript
// recalculateStats에 추가
const visitsSnapshot = await getDocs(
  query(collection(db, 'visits'), where('placeId', '==', placeId))
);

await updateDoc(doc(db, 'stats', placeId), {
  visitCount: visitsSnapshot.size,
});
```

## 체크포인트
- [x] 리뷰 작성 (tier, tags, oneLineReview)
- [x] 리뷰 수정/삭제 (본인만)
- [x] stats 자동 재계산 (reviewCount, tierCounts, topTags)
- [x] 방문 정보 (visitedAt, companions, revisitIntent) 리뷰에 통합
- [ ] 방문 기록 별도 컬렉션 (선택사항)
- [ ] 사진 업로드 (Storage)

## 참고 문서
- [REF_RATING_SYSTEM.md](REF_RATING_SYSTEM.md) - 평가 시스템 상세
- [02_DATA_MODEL.md](02_DATA_MODEL.md) - reviews, visits, stats 스키마
- [IMPL-D_SECURITY_RULES.md](IMPL-D_SECURITY_RULES.md) - Storage Rules
