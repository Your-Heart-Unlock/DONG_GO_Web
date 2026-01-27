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

## 미구현 항목 ⚠️

### 좌표 기반 중복 체크
**문제점**: 
- 네이버 ID와 카카오 ID가 다른 경우 → 같은 장소가 2번 등록 가능
- naver-resolve 매칭 실패 시 중복 발생

**해결 방안**:
1. **모든 places에서 거리 계산** (간단하지만 느림)
   ```typescript
   const allPlaces = await getDocs(collection(db, 'places'));
   const nearby = allPlaces.docs.find(doc => {
     const distance = calculateDistance(
       lat, lng,
       doc.data().lat, doc.data().lng
     );
     return distance < 100; // 100m 이내
   });
   ```

2. **geohash 기반 범위 검색** (권장)
   - places에 `geohash` 필드 추가
   - 9자 geohash = 약 5m x 5m
   - 검색 시 주변 geohash prefix 쿼리

   ```typescript
   import geohash from 'ngeohash';
   
   const hash = geohash.encode(lat, lng, 9);
   const neighbors = geohash.neighbors(hash);
   
   // 현재 + 인접 9개 geohash에서 검색
   const candidates = await Promise.all(
     [hash, ...Object.values(neighbors)].map(h =>
       getDocs(query(
         collection(db, 'places'),
         where('geohash', '>=', h.slice(0, 7)),
         where('geohash', '<=', h.slice(0, 7) + '~')
       ))
     )
   );
   
   // 정확한 거리 계산으로 최종 확인
   ```

3. **places Import 시 geohash 자동 추가**
   ```typescript
   // lib/admin/importParser.ts
   import geohash from 'ngeohash';
   
   const hash = geohash.encode(lat, lng, 9);
   placeData.geohash = hash;
   ```

## 체크포인트
- [x] 카카오 검색 API 연동
- [x] 페이지네이션 (10개씩)
- [x] 네이버 ID 매칭 (naver-resolve)
- [x] ID 기반 중복 체크
- [x] 장소 생성 (Firestore)
- [ ] geohash 또는 cellId 추가
- [ ] 좌표 기반 중복 체크

## 참고 문서
- [02_DATA_MODEL.md](02_DATA_MODEL.md) - places 스키마
- [IMPL-J_ADMIN_CONSOLE.md](IMPL-J_ADMIN_CONSOLE.md) - Import 시 geohash 적용
