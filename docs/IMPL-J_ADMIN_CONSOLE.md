# J. Admin Console (owner only)

## 목표
owner가 사용자 승인, Import, 장소 관리, 설정 편집을 할 수 있는 관리자 콘솔

## 구현 완료 ✅

### 1. Admin Dashboard
**파일**: `app/admin/page.tsx`
- owner만 접근 (OwnerGuard 또는 조건부 렌더)
- Quick Actions 카드 (users, import, places)
- 통계 요약 (추후 구현)

### 2. 사용자 관리 (`/admin/users`)
**파일**: `app/admin/users/page.tsx`
- 전체 사용자 리스트 조회
- 역할별 필터 (all, pending, member, owner)
- pending → member 승인
- 역할 변경 (member ↔ owner)

**API**: `app/api/admin/users/route.ts`, `app/api/admin/users/[uid]/route.ts`
- GET: 사용자 리스트 (owner만)
- PATCH: 역할 변경

**특징**:
- Firebase Admin SDK로 users 컬렉션 직접 조회
- 실시간 역할 반영 (Custom Claims 없이 Firestore 기반)

### 3. JSON Import (`/admin/import`)
**파일**: `app/admin/import/page.tsx`
- 네이버 지도 북마크 JSON 업로드
- 파싱 및 Preview (OK/DUPLICATE/INVALID)
- Dry-run → Commit 2단계 프로세스
- admin_logs에 작업 기록

**라이브러리**: `lib/admin/importParser.ts`
- `parseImportJSON()`: JSON → ImportRow[]
- `validateImportRows()`: 중복 체크, 필드 검증
- `calculatePreviewSummary()`: 요약 통계

**API**: `app/api/admin/import/route.ts`
- POST: Batch write (최대 500개씩)
- 트랜잭션 또는 batch 처리

## 미구현 항목 ⚠️

### 1. 요청 관리 (`/admin/requests`)
**목표**: member 요청 승인/거절

**페이지**: `app/admin/requests/page.tsx` (**현재 없음**)
- open 상태 요청 리스트
- 요청 타입별 탭 (place_edit, place_delete)
- 요청 상세 + diff view
- 승인/거절 버튼

**API**: `app/api/admin/requests/[requestId]/route.ts`
```typescript
PATCH /api/admin/requests/[requestId]
Body: { action: 'approve' | 'reject' }

// approve 시:
// 1. place 업데이트 또는 삭제
// 2. request.status = 'approved'
// 3. request.resolvedAt, resolvedBy 설정

// reject 시:
// 1. request.status = 'rejected'
```

**컴포넌트**: `components/admin/DiffView.tsx`
- Before/After 비교 UI

### 2. 장소 관리 (`/admin/places`)
**목표**: 장소 검색 및 hide/unhide 처리

**페이지**: `app/admin/places/page.tsx` (**현재 빈 페이지**)
- 검색: 이름, 카테고리, 주소
- 필터: status (active, hidden)
- 장소 리스트 (페이지네이션)
- Hide/Unhide 버튼

**구현**:
```typescript
// lib/firebase/places.ts
export async function hidePlaceByOwner(placeId: string) {
  await updateDoc(doc(db, 'places', placeId), {
    status: 'hidden',
    hiddenAt: serverTimestamp(),
  });
}

export async function unhidePlace(placeId: string) {
  await updateDoc(doc(db, 'places', placeId), {
    status: 'active',
    hiddenAt: null,
  });
}
```

**UI**:
- Hidden 장소는 지도/리스트에서 제외 (쿼리에 `where('status', '==', 'active')`)
- Admin에서만 표시

### 3. 설정 편집 (`/admin/settings`)
**목표**: rating label mapping 편집 (config/ratings)

**페이지**: `app/admin/settings/page.tsx` (**현재 없음**)
- S/A/B/C/F 등급 라벨 편집
- 카테고리 매핑 편집 (선택)

**Firestore 구조**:
```typescript
// config/ratings 문서
{
  tiers: {
    S: { label: '전파각', emoji: '🌟' },
    A: { label: '동네강자', emoji: '💪' },
    B: { label: '평타', emoji: '👌' },
    C: { label: '땜빵', emoji: '🤷' },
    F: { label: '지뢰', emoji: '💣' },
  },
  updatedAt: Timestamp,
  updatedBy: 'owner-uid',
}
```

**구현**:
```typescript
// lib/firebase/config.ts
export async function getRatingConfig() {
  const docSnap = await getDoc(doc(db, 'config', 'ratings'));
  return docSnap.data();
}

export async function updateRatingConfig(tiers, uid) {
  await setDoc(doc(db, 'config', 'ratings'), {
    tiers,
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  });
}
```

**주의**: 라벨 변경 시 기존 리뷰는 영향 없음 (tier 값 자체는 S/A/B/C/F로 저장)

### 4. Import 시 geohash/cellId 자동 추가
**목표**: 지도 성능 최적화를 위한 인덱스 필드 추가

**수정 파일**: `lib/admin/importParser.ts`
```typescript
import geohash from 'ngeohash';

export function parseImportJSON(jsonText: string): ImportRow[] {
  // ...existing parsing...
  
  rows.forEach(row => {
    // geohash 추가
    row.geohash = geohash.encode(row.lat, row.lng, 9);
    
    // 또는 cellId 추가
    const cellSize = 0.01;
    const cellLat = Math.floor(row.lat / cellSize);
    const cellLng = Math.floor(row.lng / cellSize);
    row.cellId = `${cellLat}_${cellLng}`;
  });
  
  return rows;
}
```

**패키지 설치**:
```bash
npm install ngeohash
npm install --save-dev @types/ngeohash
```

## 체크포인트
- [x] `/admin` Dashboard
- [x] `/admin/users` 사용자 승인
- [x] `/admin/import` JSON Import
- [ ] `/admin/requests` 요청 관리
- [ ] `/admin/places` 장소 hide/unhide
- [ ] `/admin/settings` 설정 편집
- [ ] Import 시 geohash/cellId 추가

## 참고 문서
- [REF_ADMIN_SPEC.md](REF_ADMIN_SPEC.md) - 관리자 기능 상세
- [IMPL-I_REQUEST_SYSTEM.md](IMPL-I_REQUEST_SYSTEM.md) - 요청 시스템
- [IMPL-E_MAP_BOTTOMSHEET.md](IMPL-E_MAP_BOTTOMSHEET.md) - geohash/cellId 활용
