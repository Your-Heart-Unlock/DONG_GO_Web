# I. 요청 시스템 (수정/삭제 요청)

## 목표
member가 place 수정/삭제 요청 → owner가 승인/거절

## 현재 상태
❌ **전체 미구현**

## 데이터 구조

### requests 컬렉션
```typescript
interface Request {
  requestId: string;
  type: 'place_edit' | 'place_delete';
  placeId: string;
  requestedBy: string; // uid
  status: 'open' | 'approved' | 'rejected';
  
  // type=place_edit인 경우
  changes?: {
    before: Partial<Place>;
    after: Partial<Place>;
  };
  
  // type=place_delete인 경우
  reason?: string;
  
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string; // owner uid
}
```

## 구현 계획

### 1. member 요청 생성
**파일**: `lib/firebase/requests.ts`
```typescript
export async function createPlaceEditRequest(
  placeId: string,
  uid: string,
  changes: { before: Partial<Place>; after: Partial<Place> }
) {
  await addDoc(collection(db, 'requests'), {
    type: 'place_edit',
    placeId,
    requestedBy: uid,
    status: 'open',
    changes,
    createdAt: serverTimestamp(),
  });
}

export async function createPlaceDeleteRequest(
  placeId: string,
  uid: string,
  reason: string
) {
  await addDoc(collection(db, 'requests'), {
    type: 'place_delete',
    placeId,
    requestedBy: uid,
    status: 'open',
    reason,
    createdAt: serverTimestamp(),
  });
}
```

### 2. member UI
**파일**: `app/places/[placeId]/page.tsx`
```tsx
{user?.role === 'member' && (
  <button onClick={() => setShowEditRequestModal(true)}>
    수정 요청
  </button>
)}
```

**파일**: `components/requests/EditRequestModal.tsx`
- 수정할 필드 선택 (name, address, category 등)
- before/after diff 표시
- 요청 제출

### 3. owner 승인/거절 페이지
**파일**: `app/admin/requests/page.tsx`
- open 상태 요청 리스트
- 요청 타입별 필터
- 요청 상세 + diff view

**파일**: `app/api/admin/requests/[requestId]/route.ts`
```typescript
export async function PATCH(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  // owner 권한 확인
  const { action } = await req.json(); // 'approve' | 'reject'
  
  if (action === 'approve') {
    // place 업데이트 또는 삭제
    // request.status = 'approved'
  } else {
    // request.status = 'rejected'
  }
}
```

### 4. diff view 컴포넌트
**파일**: `components/admin/DiffView.tsx`
```tsx
<div className="grid grid-cols-2 gap-4">
  <div>
    <h3>Before</h3>
    <pre>{JSON.stringify(before, null, 2)}</pre>
  </div>
  <div>
    <h3>After</h3>
    <pre>{JSON.stringify(after, null, 2)}</pre>
  </div>
</div>
```

### 5. member 요청 현황 조회
**파일**: `app/my-requests/page.tsx` (선택)
- 내가 만든 요청 리스트
- 상태별 필터 (open/approved/rejected)

## Firestore Rules
```javascript
match /requests/{requestId} {
  // member: 본인 요청 읽기 + 생성
  allow read: if request.auth.uid == resource.data.requestedBy
              || getUserRole(request.auth.uid) == 'owner';
  
  allow create: if request.auth != null
                && getUserRole(request.auth.uid) == 'member'
                && request.resource.data.requestedBy == request.auth.uid;
  
  // owner: 모든 요청 읽기 + 상태 업데이트
  allow update: if getUserRole(request.auth.uid) == 'owner'
                && request.resource.data.keys().hasOnly(['status', 'resolvedAt', 'resolvedBy']);
}
```

## 체크포인트
- [ ] requests 컬렉션 스키마 확정
- [ ] member 요청 생성 UI
- [ ] owner 요청 승인/거절 페이지
- [ ] diff view 컴포넌트
- [ ] Firestore Rules 적용

## 참고 문서
- [02_DATA_MODEL.md](02_DATA_MODEL.md) - requests 스키마
- [IMPL-J_ADMIN_CONSOLE.md](IMPL-J_ADMIN_CONSOLE.md) - 관리자 페이지
