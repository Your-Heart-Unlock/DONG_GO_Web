# IMPL-R: 뱃지 시스템

> **우선순위**: P2 (재미 요소)  
> **예상 소요**: 1일  
> **관련 섹션**: CHECKLIST.md R섹션, FEATURE_IDEAS.md Phase 2.3

---

## 1. 개요 및 목표

### 목표
- 활동 기반 뱃지 자동 부여
- 프로필에 뱃지 갤러리
- 리뷰 작성자 옆에 대표 뱃지 표시

### 성공 지표
- 뱃지 획득 시 성취감
- 프로필 개성 표현
- 활동 동기 부여

---

## 2. 데이터 모델

### Badge 인터페이스
```typescript
// types/index.ts에 추가
export interface Badge {
  badgeId: string;
  name: string;
  description: string;
  icon: string; // emoji
  condition: {
    type: 'review_count' | 'place_add' | 'tier_s' | 'avg_tier';
    threshold: number;
  };
  rarity: 'common' | 'rare' | 'epic'; // 희귀도
}

export interface UserBadge {
  badgeId: string;
  uid: string;
  earnedAt: Date;
  isRepresentative: boolean; // 대표 뱃지 여부
}
```

### 기본 뱃지 정의
```typescript
// lib/firebase/badges.ts (신규)
export const BADGES: Badge[] = [
  // 리뷰 관련
  {
    badgeId: 'first_review',
    name: '첫 리뷰',
    description: '첫 리뷰를 작성했어요',
    icon: '✍️',
    condition: { type: 'review_count', threshold: 1 },
    rarity: 'common',
  },
  {
    badgeId: 'reviewer_10',
    name: '리뷰어',
    description: '리뷰 10개 작성',
    icon: '📝',
    condition: { type: 'review_count', threshold: 10 },
    rarity: 'common',
  },
  {
    badgeId: 'veteran_50',
    name: '베테랑',
    description: '리뷰 50개 작성',
    icon: '🎖️',
    condition: { type: 'review_count', threshold: 50 },
    rarity: 'rare',
  },
  {
    badgeId: 'master_100',
    name: '마스터',
    description: '리뷰 100개 작성',
    icon: '🏅',
    condition: { type: 'review_count', threshold: 100 },
    rarity: 'epic',
  },
  
  // 장소 추가 관련
  {
    badgeId: 'explorer',
    name: '탐험가',
    description: '장소 5개 추가',
    icon: '🗺️',
    condition: { type: 'place_add', threshold: 5 },
    rarity: 'common',
  },
  {
    badgeId: 'discoverer',
    name: '발굴자',
    description: '장소 20개 추가',
    icon: '🔍',
    condition: { type: 'place_add', threshold: 20 },
    rarity: 'rare',
  },
  
  // S등급 관련
  {
    badgeId: 'perfectionist',
    name: '완벽주의자',
    description: 'S등급 10개',
    icon: '⭐',
    condition: { type: 'tier_s', threshold: 10 },
    rarity: 'rare',
  },
  {
    badgeId: 'star_collector',
    name: '별 수집가',
    description: 'S등급 30개',
    icon: '🌟',
    condition: { type: 'tier_s', threshold: 30 },
    rarity: 'epic',
  },
  
  // 평균 등급 관련
  {
    badgeId: 'foodie',
    name: '미식가',
    description: '평균 등급 4.0 이상',
    icon: '🍽️',
    condition: { type: 'avg_tier', threshold: 4.0 },
    rarity: 'rare',
  },
  {
    badgeId: 'gourmet',
    name: '진정한 미식가',
    description: '평균 등급 4.5 이상',
    icon: '👨‍🍳',
    condition: { type: 'avg_tier', threshold: 4.5 },
    rarity: 'epic',
  },
];
```

### User 문서 확장
```typescript
export interface User {
  // ... 기존 필드
  
  badges: string[]; // badgeId 배열
  representativeBadge?: string; // 대표 뱃지 badgeId
}
```

---

## 3. 뱃지 부여 로직

### lib/firebase/badges.ts
```typescript
import { db } from './admin';
import { Badge, UserBadge } from '@/types';

/**
 * 사용자가 획득 가능한 뱃지 확인 및 부여
 */
export async function checkAndAwardBadges(uid: string): Promise<string[]> {
  const newBadges: string[] = [];
  
  // 현재 사용자 뱃지
  const userDoc = await db.collection('users').doc(uid).get();
  const currentBadges = userDoc.data()?.badges || [];
  
  // 통계 계산
  const reviewsCount = (await db.collection('reviews')
    .where('uid', '==', uid)
    .get()
  ).size;
  
  const placesCount = (await db.collection('places')
    .where('createdBy', '==', uid)
    .get()
  ).size;
  
  const sGradesSnapshot = await db.collection('reviews')
    .where('uid', '==', uid)
    .where('ratingTier', '==', 'S')
    .get();
  const sCount = sGradesSnapshot.size;
  
  // 평균 등급 계산
  const reviewsSnapshot = await db.collection('reviews')
    .where('uid', '==', uid)
    .get();
  const tierValues = { S: 5, A: 4, B: 3, C: 2, F: 1 };
  let tierSum = 0;
  reviewsSnapshot.docs.forEach(doc => {
    tierSum += tierValues[doc.data().ratingTier];
  });
  const avgTier = reviewsCount > 0 ? tierSum / reviewsCount : 0;
  
  // 각 뱃지 조건 확인
  for (const badge of BADGES) {
    // 이미 획득한 뱃지는 스킵
    if (currentBadges.includes(badge.badgeId)) continue;
    
    let earned = false;
    
    switch (badge.condition.type) {
      case 'review_count':
        earned = reviewsCount >= badge.condition.threshold;
        break;
      case 'place_add':
        earned = placesCount >= badge.condition.threshold;
        break;
      case 'tier_s':
        earned = sCount >= badge.condition.threshold;
        break;
      case 'avg_tier':
        earned = avgTier >= badge.condition.threshold;
        break;
    }
    
    if (earned) {
      newBadges.push(badge.badgeId);
    }
  }
  
  // 새 뱃지 부여
  if (newBadges.length > 0) {
    await db.collection('users').doc(uid).update({
      badges: [...currentBadges, ...newBadges],
    });
    
    // user_badges 컬렉션에도 기록
    const batch = db.batch();
    newBadges.forEach(badgeId => {
      const ref = db.collection('user_badges').doc();
      const userBadge: UserBadge = {
        badgeId,
        uid,
        earnedAt: new Date(),
        isRepresentative: false,
      };
      batch.set(ref, userBadge);
    });
    await batch.commit();
  }
  
  return newBadges;
}

/**
 * 뱃지 정보 조회
 */
export function getBadgeInfo(badgeId: string): Badge | undefined {
  return BADGES.find(b => b.badgeId === badgeId);
}

/**
 * 대표 뱃지 설정
 */
export async function setRepresentativeBadge(uid: string, badgeId: string) {
  const userDoc = await db.collection('users').doc(uid).get();
  const badges = userDoc.data()?.badges || [];
  
  if (!badges.includes(badgeId)) {
    throw new Error('Badge not owned');
  }
  
  await db.collection('users').doc(uid).update({
    representativeBadge: badgeId,
  });
}
```

---

## 4. API 설계

### POST /api/badges/check
```typescript
// app/api/badges/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { checkAndAwardBadges } from '@/lib/firebase/badges';

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const uid = session.user.email;
  const newBadges = await checkAndAwardBadges(uid);
  
  return NextResponse.json({ newBadges });
}
```

### PATCH /api/users/me/representative-badge
```typescript
// app/api/users/me/representative-badge/route.ts
export async function PATCH(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { badgeId } = await request.json();
  const uid = session.user.email;
  
  await setRepresentativeBadge(uid, badgeId);
  return NextResponse.json({ success: true });
}
```

---

## 5. UI 구현

### 5.1 뱃지 획득 토스트
```tsx
// hooks/useBadgeNotification.ts
import { useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { getBadgeInfo } from '@/lib/firebase/badges';

export function useBadgeNotification() {
  const checkBadges = async () => {
    const res = await fetch('/api/badges/check', { method: 'POST' });
    const data = await res.json();
    
    if (data.newBadges && data.newBadges.length > 0) {
      data.newBadges.forEach((badgeId: string) => {
        const badge = getBadgeInfo(badgeId);
        if (badge) {
          toast.success(
            <div>
              <div className="font-bold">🎉 새 뱃지 획득!</div>
              <div className="text-sm">
                {badge.icon} {badge.name}
              </div>
            </div>,
            { duration: 5000 }
          );
        }
      });
    }
  };
  
  return { checkBadges };
}
```

### 5.2 프로필 뱃지 갤러리
```tsx
// app/me/badges/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge, BADGES, getBadgeInfo } from '@/lib/firebase/badges';

export default function MyBadgesPage() {
  const { user } = useAuth();
  const [myBadges, setMyBadges] = useState<string[]>([]);
  const [representative, setRepresentative] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchMyBadges();
    }
  }, [user]);

  const fetchMyBadges = async () => {
    const res = await fetch(`/api/users/${user.uid}`);
    const data = await res.json();
    setMyBadges(data.badges || []);
    setRepresentative(data.representativeBadge || null);
  };

  const setRepresentativeBadge = async (badgeId: string) => {
    await fetch('/api/users/me/representative-badge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ badgeId }),
    });
    setRepresentative(badgeId);
  };

  const earned = BADGES.filter(b => myBadges.includes(b.badgeId));
  const locked = BADGES.filter(b => !myBadges.includes(b.badgeId));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold">내 뱃지</h1>
        <p className="text-sm text-gray-600">{earned.length}/{BADGES.length} 획득</p>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* 획득한 뱃지 */}
        <section>
          <h2 className="text-xl font-bold mb-4">획득한 뱃지 ({earned.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {earned.map(badge => (
              <BadgeCard
                key={badge.badgeId}
                badge={badge}
                earned
                isRepresentative={badge.badgeId === representative}
                onSetRepresentative={() => setRepresentativeBadge(badge.badgeId)}
              />
            ))}
          </div>
        </section>

        {/* 잠긴 뱃지 */}
        <section>
          <h2 className="text-xl font-bold mb-4">잠긴 뱃지 ({locked.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {locked.map(badge => (
              <BadgeCard key={badge.badgeId} badge={badge} earned={false} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function BadgeCard({
  badge,
  earned,
  isRepresentative,
  onSetRepresentative,
}: {
  badge: Badge;
  earned: boolean;
  isRepresentative?: boolean;
  onSetRepresentative?: () => void;
}) {
  const rarityColors = {
    common: 'bg-gray-100 border-gray-300',
    rare: 'bg-blue-100 border-blue-300',
    epic: 'bg-purple-100 border-purple-300',
  };

  return (
    <div
      className={`border-2 rounded-lg p-4 ${
        earned ? rarityColors[badge.rarity] : 'bg-gray-50 border-gray-200 opacity-50'
      } ${isRepresentative ? 'ring-4 ring-yellow-400' : ''}`}
    >
      <div className="text-center">
        <div className={`text-5xl mb-2 ${!earned && 'filter grayscale'}`}>
          {badge.icon}
        </div>
        <div className="font-bold">{badge.name}</div>
        <div className="text-xs text-gray-600 mt-1">{badge.description}</div>
        
        {earned && onSetRepresentative && (
          <button
            onClick={onSetRepresentative}
            className={`mt-2 text-xs px-2 py-1 rounded ${
              isRepresentative
                ? 'bg-yellow-400 text-black'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {isRepresentative ? '✓ 대표' : '대표로'}
          </button>
        )}
        
        {!earned && (
          <div className="mt-2 text-xs text-gray-500">
            {badge.condition.type === 'review_count' && `리뷰 ${badge.condition.threshold}개`}
            {badge.condition.type === 'place_add' && `장소 ${badge.condition.threshold}개`}
            {badge.condition.type === 'tier_s' && `S등급 ${badge.condition.threshold}개`}
            {badge.condition.type === 'avg_tier' && `평균 ${badge.condition.threshold}점`}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 5.3 리뷰 작성자 옆 뱃지 표시
```tsx
// components/reviews/ReviewCard.tsx 수정
export default function ReviewCard({ review }: { review: Review }) {
  const [badge, setBadge] = useState<Badge | null>(null);

  useEffect(() => {
    fetchUserBadge();
  }, [review.uid]);

  const fetchUserBadge = async () => {
    const res = await fetch(`/api/users/${review.uid}`);
    const user = await res.json();
    if (user.representativeBadge) {
      const badgeInfo = getBadgeInfo(user.representativeBadge);
      setBadge(badgeInfo || null);
    }
  };

  return (
    <div className="review-card">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{review.nickname}</span>
        {badge && (
          <span
            className="text-xs"
            title={badge.name}
          >
            {badge.icon}
          </span>
        )}
      </div>
      {/* 리뷰 내용 */}
    </div>
  );
}
```

---

## 6. 자동 체크 트리거

### 리뷰 작성 후
```typescript
// app/api/reviews/route.ts에 추가
export async function POST(request: NextRequest) {
  // ... 리뷰 생성 로직
  
  // 뱃지 체크
  const newBadges = await checkAndAwardBadges(uid);
  
  return NextResponse.json({
    review,
    newBadges, // 클라이언트에서 토스트 표시
  });
}
```

### 장소 추가 후
```typescript
// app/api/places/route.ts에 추가
export async function POST(request: NextRequest) {
  // ... 장소 생성 로직
  
  // 뱃지 체크
  const newBadges = await checkAndAwardBadges(uid);
  
  return NextResponse.json({
    place,
    newBadges,
  });
}
```

---

## 7. 구현 체크리스트

### Phase 1: 백엔드 (0.5일)
- [ ] types/index.ts에 Badge, UserBadge 추가
- [ ] lib/firebase/badges.ts 생성
  - [ ] BADGES 배열 정의 (10개)
  - [ ] checkAndAwardBadges()
  - [ ] getBadgeInfo()
  - [ ] setRepresentativeBadge()
- [ ] API: POST /api/badges/check
- [ ] API: PATCH /api/users/me/representative-badge

### Phase 2: UI (0.5일)
- [ ] hooks/useBadgeNotification.ts
- [ ] app/me/badges/page.tsx
  - [ ] BadgeCard 컴포넌트
  - [ ] 획득/잠긴 구분
  - [ ] 대표 뱃지 설정
- [ ] ReviewCard에 대표 뱃지 표시
- [ ] 리뷰/장소 추가 후 자동 체크

### 테스트
- [ ] 뱃지 자동 부여
- [ ] 토스트 알림
- [ ] 대표 뱃지 설정
- [ ] 리뷰에 뱃지 표시

---

## 8. 테스트 시나리오

### 시나리오 1: 첫 리뷰 뱃지
1. 첫 리뷰 작성
2. ✅ "🎉 새 뱃지 획득! ✍️ 첫 리뷰" 토스트
3. 내 뱃지 페이지 확인
4. ✅ "첫 리뷰" 뱃지 획득 상태

### 시나리오 2: 대표 뱃지
1. 내 뱃지 페이지에서 "미식가" 클릭
2. "대표로" 버튼 클릭
3. ✅ 노란 링으로 강조
4. 리뷰 작성
5. ✅ 내 닉네임 옆에 🍽️ 표시

### 시나리오 3: 잠긴 뱃지
1. 리뷰 5개만 작성한 상태
2. ✅ "리뷰어 (10개)" 뱃지는 잠김 상태
3. ✅ 그레이스케일 + "리뷰 10개" 안내

---

## 참고 문서
- FEATURE_IDEAS.md Phase 2.3
- CHECKLIST.md R섹션
