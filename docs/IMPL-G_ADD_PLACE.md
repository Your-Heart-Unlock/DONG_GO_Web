# G. 장소 추가 (네이버 placeId 기반)

## 목표
카카오 검색 → 네이버 ID 매칭 → 중복 체크 → 장소 생성

## 구현 완료 ✅

### 1. 장소 추가 페이지
**파일**: `app/add/page.tsx`
- member/owner만 접근 가능 (OwnerGuard 또는 조건부 렌더)
- 검색 입력 → API 호출 → 결과 리스트

### 2. 카카오 검색 API
**파일**: `app/api/search/places/route.ts`
```typescript
const response = await fetch(
  `https://dapi.kakao.com/v2/local/search/keyword.json?query=${query}&page=${page}&size=10`,
  {
    headers: {
      Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY}`,
    },
  }
);
```
- 페이지네이션: 10개씩
- 결과: placeId (카카오 ID), name, address, lat, lng, category

### 3. 네이버 ID 매칭 (naver-resolve)
**파일**: `app/api/search/naver-resolve/route.ts`
- 입력: name, lat, lng
- 네이버 검색 API로 동일 장소 찾기
- 좌표 거리 < 100m → 네이버 placeId 반환
- 실패 시: undefined (카카오 ID 사용)

**클라이언트**:
```typescript
let finalPlaceId = place.placeId; // 카카오 ID 기본
try {
  const resolveRes = await fetch(
    `/api/search/naver-resolve?name=${name}&lat=${lat}&lng=${lng}`
  );
  const data = await resolveRes.json();
  if (data.naverPlaceId) {
    finalPlaceId = data.naverPlaceId;
  }
} catch {
  // 매칭 실패, 카카오 ID 유지
}
```

### 4. 중복 체크 (ID 기반)
```typescript
const existing = await getPlaceById(finalPlaceId);
const existingKakao = finalPlaceId !== place.placeId
  ? await getPlaceById(place.placeId)
  : null;

if (existing || existingKakao) {
  alert('이미 등록된 장소입니다.');
  router.push(`/places/${existing ? finalPlaceId : place.placeId}`);
  return;
}
```

### 5. 장소 생성
**파일**: `lib/firebase/places.ts` - `createPlace()`
```typescript
await setDoc(doc(db, 'places', placeId), {
  placeId,
  name,
  address,
  lat,
  lng,
  category,
  source: 'user_added',
  status: 'active',
  createdAt: serverTimestamp(),
});
```

### 6. 네이버 검색 폴백 UI ✅
**파일**: `app/add/page.tsx`

카카오 검색 결과가 0건일 때 네이버 검색을 안내:
- "네이버에서 검색하기" 버튼 표시 (카카오 0건 시)
- 네이버 검색 모드 전환 (상단 안내 배너)
- 도움말: "네이버 검색은 최대 5개 결과. 식당 이름 뒤에 지역명 추가 권장"
- 카카오/네이버 검색 모드 전환 가능

**검색 API**: `app/api/search/places/route.ts`
- `provider` 쿼리 파라미터 추가 (`kakao` | `naver`, 기본값: `kakao`)
- 각 provider별 독립 검색 (자동 폴백 제거)

### 7. 크로스 지도 ID 매칭 ✅
**목표**: 장소 추가 시 카카오/네이버 양쪽 지도 상세 페이지 ID를 확보

**Place 필드 추가** (`types/index.ts`):
- `naverPlaceId` (string, optional) - 네이버 지도 상세 페이지 ID
- `kakaoPlaceId` (string, optional) - 카카오 지도 상세 페이지 ID

**매칭 API**:
- 카카오→네이버: `app/api/search/naver-resolve/route.ts` (기존)
- 네이버→카카오: `app/api/search/kakao-resolve/route.ts` (신규)

**장소 추가 시 동작**:
```typescript
// 카카오로 추가 시
kakaoPlaceId = place.placeId;
naverPlaceId = naver-resolve API 결과; // 없으면 undefined

// 네이버로 추가 시
naverPlaceId = place.placeId에서 naver_ 접두사 제거;
kakaoPlaceId = kakao-resolve API 결과; // 없으면 undefined
```

## 체크포인트
- [x] 카카오 검색 API 연동
- [x] 페이지네이션 (10개씩)
- [x] 네이버 ID 매칭 (naver-resolve)
- [x] ID 기반 중복 체크
- [x] 장소 생성 (Firestore)
- [x] geohash 또는 cellId 추가
- [x] 좌표 기반 중복 체크
- [x] 네이버 검색 폴백 UI
- [x] 크로스 지도 ID 매칭 (naverPlaceId, kakaoPlaceId)

## 참고 문서
- [02_DATA_MODEL.md](02_DATA_MODEL.md) - places 스키마
- [IMPL-J_ADMIN_CONSOLE.md](IMPL-J_ADMIN_CONSOLE.md) - Import 시 geohash 적용
- [IMPL-F_PLACE_DETAIL.md](IMPL-F_PLACE_DETAIL.md) - 지도 링크 동적 처리
