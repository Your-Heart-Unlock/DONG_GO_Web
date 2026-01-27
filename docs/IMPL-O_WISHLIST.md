# IMPL-O: 위시리스트 ("가고 싶어요")

> **우선순위**: P1 (핵심 기능)  
> **예상 소요**: 1.5일  
> **관련 섹션**: CHECKLIST.md O섹션, FEATURE_IDEAS.md Phase 1.1

---

## 1. 개요 및 목표

### 문제점
- 가고 싶은 장소를 북마크할 방법이 없음
- 친구들이 어떤 장소에 관심 있는지 알 수 없음
- 방문 계획을 세울 때 도움이 될 정보 부족

### 목표
- 장소에 "가고 싶어요" 표시
- 내 위시리스트 페이지에서 한눈에 보기
- 친구들이 얼마나 많이 가고 싶어하는지 표시
- "우리 모두가 가고 싶어하는 곳" 추천

### 성공 지표
- 각 장소마다 wishCount 표시
- 위시리스트 페이지에서 지도로 시각화
- 친구들의 관심도가 장소 선택에 영향

---

## 2. 데이터 모델

### Firestore 컬렉션 설계

```typescript
// types/index.ts에 추가
export interface WishVisit {
  wishId: string;
  placeId: string;
  uid: string;
  createdAt: Date;
  note?: string; // 선택사항: "여기 스테이크 먹어보고 싶음"
}

// 컬렉션 구조
wishes/{wishId}
  - placeId: string (인덱스 필요)
  - uid: string (인덱스 필요)
  - createdAt: Timestamp
  - note: string (optional)

// 복합 인덱스 필요
wishes
  - placeId (ascending)
  - createdAt (descending)

wishes
  - uid (ascending)
  - createdAt (descending)
```

### PlaceStats 확장
```typescript
// types/index.ts 수정
export interface PlaceStats {
  placeId: string;
  reviewCount: number;
  tierCounts: { S: number; A: number; B: number; C: number; F: number };
  avgTier: RatingTier | null;
  topTags: string[];
  
  // 추가
  wishCount: number; // 가고 싶어요 총 개수
  wishers?: string[]; // 가고 싶어하는 사람들의 uid (최대 5명)
}
```

### User 프로필 확장 (선택)
```typescript
export interface User {
  // ... 기존 필드
  
  // 통계에 추가
  stats?: {
    totalReviews: number;
    totalWishes: number; // 추가
  };
}
```

---

## 3. API 설계

### POST /api/wishes
**Request**:
```typescript
{
  placeId: string;
  note?: string;
}
```

**Response**:
```typescript
{
  wishId: string;
  createdAt: Date;
}
```

**구현**:
```typescript
// app/api/wishes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const uid = session.user.email;
  const { placeId, note } = await request.json();
  
  // 이미 위시리스트에 있는지 확인
  const existingWish = await db.collection('wishes')
    .where('placeId', '==', placeId)
    .where('uid', '==', uid)
    .get();
  
  if (!existingWish.empty) {
    return NextResponse.json(
      { error: 'Already in wishlist' },
      { status: 400 }
    );
  }
  
  // 위시 생성
  const wishRef = db.collection('wishes').doc();
  const wish: WishVisit = {
    wishId: wishRef.id,
    placeId,
    uid,
    createdAt: new Date(),
    note,
  };
  
  await wishRef.set(wish);
  
  // PlaceStats의 wishCount 증가
  const statsRef = db.collection('stats').doc(placeId);
  await statsRef.update({
    wishCount: FieldValue.increment(1),
    wishers: FieldValue.arrayUnion(uid),
  });
  
  return NextResponse.json({ wishId: wishRef.id, createdAt: wish.createdAt });
}
```

### DELETE /api/wishes/{wishId}
```typescript
// app/api/wishes/[wishId]/route.ts
export async function DELETE(
  request: NextRequest,
  { params }: { params: { wishId: string } }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const wishRef = db.collection('wishes').doc(params.wishId);
  const wishDoc = await wishRef.get();
  
  if (!wishDoc.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  const wish = wishDoc.data() as WishVisit;
  
  // 본인 위시만 삭제 가능
  if (wish.uid !== session.user.email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // 위시 삭제
  await wishRef.delete();
  
  // PlaceStats의 wishCount 감소
  const statsRef = db.collection('stats').doc(wish.placeId);
  await statsRef.update({
    wishCount: FieldValue.increment(-1),
    wishers: FieldValue.arrayRemove(wish.uid),
  });
  
  return NextResponse.json({ success: true });
}
```

### GET /api/wishes
**Query Parameters**:
- `uid`: 특정 사용자의 위시리스트
- `placeId`: 특정 장소를 wish한 사람들

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid');
  const placeId = searchParams.get('placeId');
  
  let query = db.collection('wishes');
  
  if (uid) {
    query = query.where('uid', '==', uid);
  }
  
  if (placeId) {
    query = query.where('placeId', '==', placeId);
  }
  
  query = query.orderBy('createdAt', 'desc');
  
  const snapshot = await query.get();
  const wishes = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  return NextResponse.json({ wishes });
}
```

---

## 4. UI/UX 구현

### 4.1 장소 바텀시트에 "가고 싶어요" 버튼
```tsx
// components/map/PlaceBottomSheet.tsx 수정
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function PlaceBottomSheet({ place }: { place: Place }) {
  const { user } = useAuth();
  const [isWished, setIsWished] = useState(false);
  const [wishId, setWishId] = useState<string | null>(null);
  const [wishCount, setWishCount] = useState(0);
  const [wishers, setWishers] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      checkIfWished();
    }
    fetchWishStats();
  }, [place.placeId, user]);

  const checkIfWished = async () => {
    const res = await fetch(`/api/wishes?uid=${user.uid}&placeId=${place.placeId}`);
    const data = await res.json();
    if (data.wishes.length > 0) {
      setIsWished(true);
      setWishId(data.wishes[0].wishId);
    }
  };

  const fetchWishStats = async () => {
    const res = await fetch(`/api/stats/${place.placeId}`);
    const stats = await res.json();
    setWishCount(stats.wishCount || 0);
    setWishers(stats.wishers || []);
  };

  const toggleWish = async () => {
    if (isWished && wishId) {
      // 위시 삭제
      await fetch(`/api/wishes/${wishId}`, { method: 'DELETE' });
      setIsWished(false);
      setWishId(null);
      setWishCount(prev => prev - 1);
    } else {
      // 위시 추가
      const res = await fetch('/api/wishes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: place.placeId }),
      });
      const data = await res.json();
      setIsWished(true);
      setWishId(data.wishId);
      setWishCount(prev => prev + 1);
    }
  };

  return (
    <div className="bg-white rounded-t-2xl shadow-lg p-4">
      {/* 기존 장소 정보 */}
      <h2 className="text-xl font-bold">{place.name}</h2>
      <p className="text-gray-600">{place.address}</p>
      
      {/* 가고 싶어요 버튼 */}
      <button
        onClick={toggleWish}
        className={`mt-4 w-full py-3 rounded-lg flex items-center justify-center gap-2 ${
          isWished
            ? 'bg-red-50 text-red-500 border border-red-200'
            : 'bg-gray-50 text-gray-500 border border-gray-200'
        }`}
      >
        <span className="text-2xl">{isWished ? '💚' : '🤍'}</span>
        <span className="font-semibold">
          가고 싶어요 ({wishCount})
        </span>
      </button>
      
      {/* 가고 싶어하는 친구들 */}
      {wishers.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          <WishersList wishers={wishers} />
        </div>
      )}
      
      {/* 기존 상세보기 버튼 등 */}
    </div>
  );
}

function WishersList({ wishers }: { wishers: string[] }) {
  const [userNames, setUserNames] = useState<string[]>([]);
  
  useEffect(() => {
    fetchUserNames();
  }, [wishers]);
  
  const fetchUserNames = async () => {
    // uid들로 닉네임 가져오기
    const names = await Promise.all(
      wishers.slice(0, 3).map(async uid => {
        const res = await fetch(`/api/users/${uid}`);
        const user = await res.json();
        return user.nickname;
      })
    );
    setUserNames(names);
  };
  
  return (
    <div className="flex items-center gap-1">
      {userNames.slice(0, 2).map((name, idx) => (
        <span key={idx} className="font-medium">{name}</span>
      ))}
      {userNames.length > 2 && (
        <span>외 {wishers.length - 2}명이</span>
      )}
      <span>가고 싶어해요</span>
    </div>
  );
}
```

### 4.2 내 위시리스트 페이지
```tsx
// app/me/wishlist/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import NaverMapView from '@/components/map/NaverMapView';

export default function MyWishlistPage() {
  const { user } = useAuth();
  const [wishes, setWishes] = useState<WishVisit[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);

  useEffect(() => {
    if (user) {
      fetchMyWishes();
    }
  }, [user]);

  const fetchMyWishes = async () => {
    const res = await fetch(`/api/wishes?uid=${user.uid}`);
    const data = await res.json();
    setWishes(data.wishes);
    
    // 장소 정보 가져오기
    const placeIds = data.wishes.map((w: WishVisit) => w.placeId);
    const placesData = await Promise.all(
      placeIds.map(async (id: string) => {
        const res = await fetch(`/api/places/${id}`);
        return res.json();
      })
    );
    setPlaces(placesData);
  };

  const removeWish = async (wishId: string) => {
    await fetch(`/api/wishes/${wishId}`, { method: 'DELETE' });
    setWishes(wishes.filter(w => w.wishId !== wishId));
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold">가고 싶어요 ({wishes.length})</h1>
      </header>
      
      <div className="flex flex-col md:flex-row h-[calc(100vh-80px)]">
        {/* 지도 */}
        <div className="flex-1">
          <NaverMapView places={places} highlightWished />
        </div>
        
        {/* 리스트 */}
        <div className="w-full md:w-96 bg-white overflow-y-auto">
          {wishes.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              아직 가고 싶은 장소가 없어요
            </div>
          ) : (
            <div className="divide-y">
              {wishes.map((wish, idx) => {
                const place = places[idx];
                if (!place) return null;
                
                return (
                  <WishListItem
                    key={wish.wishId}
                    wish={wish}
                    place={place}
                    onRemove={() => removeWish(wish.wishId)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WishListItem({ wish, place, onRemove }: any) {
  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-bold">{place.name}</h3>
          <p className="text-sm text-gray-600">{place.category}</p>
          <p className="text-sm text-gray-500">{place.address}</p>
          {wish.note && (
            <p className="mt-2 text-sm text-blue-600">💭 {wish.note}</p>
          )}
        </div>
        <button
          onClick={onRemove}
          className="text-red-500 text-sm"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
```

### 4.3 프로필에 위시리스트 탭
```tsx
// app/me/page.tsx에 탭 추가
export default function MyProfilePage() {
  const [activeTab, setActiveTab] = useState<'reviews' | 'wishes'>('reviews');
  
  return (
    <div>
      <header>
        {/* 프로필 정보 */}
      </header>
      
      {/* 탭 */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('reviews')}
          className={`flex-1 py-3 ${
            activeTab === 'reviews'
              ? 'border-b-2 border-blue-500 font-semibold'
              : 'text-gray-500'
          }`}
        >
          내 리뷰 ({reviewCount})
        </button>
        <button
          onClick={() => setActiveTab('wishes')}
          className={`flex-1 py-3 ${
            activeTab === 'wishes'
              ? 'border-b-2 border-blue-500 font-semibold'
              : 'text-gray-500'
          }`}
        >
          가고 싶어요 ({wishCount})
        </button>
      </div>
      
      {/* 탭 컨텐츠 */}
      {activeTab === 'reviews' ? <MyReviews /> : <MyWishlist />}
    </div>
  );
}
```

### 4.4 홈 화면 위젯
```tsx
// app/page.tsx에 추가
export default function HomePage() {
  const [topWishedPlaces, setTopWishedPlaces] = useState<Place[]>([]);
  
  useEffect(() => {
    fetchTopWished();
  }, []);
  
  const fetchTopWished = async () => {
    // wishCount가 높은 순으로 TOP 5
    const res = await fetch('/api/places?sortBy=wishes&limit=5');
    const data = await res.json();
    setTopWishedPlaces(data.places);
  };
  
  return (
    <div>
      {/* 기존 지도 */}
      <NaverMapView />
      
      {/* 위젯 */}
      <div className="absolute bottom-20 left-4 right-4 bg-white rounded-lg shadow-lg p-4">
        <h3 className="font-bold mb-2">친구들이 가장 가고 싶어하는 곳 🔥</h3>
        <div className="space-y-2">
          {topWishedPlaces.map(place => (
            <div key={place.placeId} className="flex justify-between">
              <span>{place.name}</span>
              <span className="text-sm text-gray-500">
                💚 {place.stats?.wishCount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 5. 구현 체크리스트

### Phase 1: 데이터 모델 (0.25일)
- [ ] types/index.ts에 WishVisit 인터페이스 추가
- [ ] PlaceStats에 wishCount, wishers 필드 추가
- [ ] Firestore 복합 인덱스 생성
  - [ ] wishes: placeId + createdAt
  - [ ] wishes: uid + createdAt

### Phase 2: API (0.5일)
- [ ] POST /api/wishes - 위시 추가
  - [ ] 중복 체크
  - [ ] stats wishCount 증가
- [ ] DELETE /api/wishes/[wishId] - 위시 삭제
  - [ ] 본인 확인
  - [ ] stats wishCount 감소
- [ ] GET /api/wishes - 위시 조회
  - [ ] uid 필터
  - [ ] placeId 필터

### Phase 3: UI 컴포넌트 (0.75일)
- [ ] PlaceBottomSheet에 "가고 싶어요" 버튼
  - [ ] 토글 기능
  - [ ] wishCount 표시
  - [ ] WishersList 컴포넌트
- [ ] /me/wishlist 페이지
  - [ ] 지도 + 리스트 레이아웃
  - [ ] WishListItem 컴포넌트
  - [ ] 위시 삭제 기능
- [ ] 프로필에 위시리스트 탭
- [ ] 홈 화면 위젯 ("친구들이 가장 가고 싶어하는 곳")

### 테스트
- [ ] 위시 추가/삭제 동작
- [ ] wishCount 실시간 업데이트
- [ ] 내 위시리스트 페이지
- [ ] 친구들이 많이 wish한 장소 TOP 5

---

## 6. 테스트 시나리오

### 시나리오 1: 위시 추가
1. 지도에서 장소 마커 클릭
2. 바텀시트에서 "🤍 가고 싶어요 (0)" 버튼 클릭
3. ✅ 버튼이 "💚 가고 싶어요 (1)"로 변경
4. ✅ stats의 wishCount 증가

### 시나리오 2: 내 위시리스트
1. 프로필에서 "가고 싶어요 (3)" 탭 클릭
2. ✅ 내가 wish한 3개 장소 표시
3. 장소 클릭 → 상세 페이지 이동
4. ✅ 정상 동작

### 시나리오 3: 친구들의 관심도
1. 3명이 같은 장소에 wish
2. 해당 장소 바텀시트 열기
3. ✅ "동훈, 민지, 철수님이 가고 싶어해요" 표시

### 시나리오 4: 위시 삭제
1. 내 위시리스트에서 삭제 버튼 클릭
2. ✅ 목록에서 제거
3. ✅ stats wishCount 감소
4. 해당 장소 다시 방문
5. ✅ "🤍 가고 싶어요" 상태로 초기화

---

## 7. 고급 기능 (나중에)

### Phase 2 확장
- [ ] 위시에 메모 추가 ("여기 스테이크 꼭 먹어보기")
- [ ] 위시에 우선순위 (⭐⭐⭐)
- [ ] 위시에 태그 (#데이트 #가족외식)
- [ ] "친구들과 함께 가고 싶어요" 버튼
- [ ] 위시 공유 (카카오톡으로 친구 초대)

### 알림 연동
- [ ] 친구가 내 wish한 장소에 리뷰 작성 시 알림
- [ ] 내 wish한 장소가 S등급 받으면 알림

---

## 참고 문서
- FEATURE_IDEAS.md Phase 1.1
- CHECKLIST.md O섹션
- 02_DATA_MODEL.md (Firestore 구조)
