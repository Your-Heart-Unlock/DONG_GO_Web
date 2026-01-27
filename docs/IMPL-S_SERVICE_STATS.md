# IMPL-S: 전체 통계 페이지

> **우선순위**: P2 (완성도)  
> **예상 소요**: 1일  
> **관련 섹션**: CHECKLIST.md S섹션, FEATURE_IDEAS.md Phase 3.2

---

## 1. 개요 및 목표

### 목표
- 서비스 전체 통계 조회 (`/stats`)
- 인기 장소 TOP 10
- 카테고리/등급 분포
- "우리가 지금까지 OO곳 발굴" 같은 재미 요소

### 성공 지표
- 서비스 활동 현황 한눈에 파악
- 인기 장소 발견
- 커뮤니티 일체감 형성

---

## 2. 데이터 모델

### ServiceStats 인터페이스
```typescript
// types/index.ts에 추가
export interface ServiceStats {
  // 기본 통계
  totalPlaces: number;
  totalReviews: number;
  totalUsers: number;
  
  // 인기 장소
  topPlaces: {
    place: Place;
    stats: PlaceStats;
  }[];
  
  // 카테고리 분포
  categoryDistribution: {
    category: string;
    count: number;
    percentage: number;
  }[];
  
  // 등급 분포
  tierDistribution: {
    tier: RatingTier;
    count: number;
    percentage: number;
  }[];
  
  // 최근 활동
  recentlyAdded: Place[]; // 최근 추가된 장소
  recentReviews: Review[]; // 최근 리뷰
  
  // 재미 통계
  mostReviewedPlace: Place; // 리뷰 가장 많은 곳
  highestRatedPlace: Place; // 평균 등급 가장 높은 곳
  controversialPlace?: Place; // 평가 편차 큰 곳 (S와 F가 공존)
  hiddenGem?: Place; // 리뷰 3개 이하지만 S등급
  
  // 월별 추이
  growthData: {
    month: string;
    places: number;
    reviews: number;
  }[];
}
```

---

## 3. 통계 계산 로직

### lib/firebase/serviceStats.ts (신규)
```typescript
import { db } from './admin';
import { ServiceStats, Place, PlaceStats } from '@/types';

/**
 * 전체 서비스 통계 계산
 */
export async function calculateServiceStats(): Promise<ServiceStats> {
  // 1. 기본 카운트
  const placesSnapshot = await db.collection('places')
    .where('status', '==', 'active')
    .get();
  const totalPlaces = placesSnapshot.size;
  
  const reviewsSnapshot = await db.collection('reviews').get();
  const totalReviews = reviewsSnapshot.size;
  
  const usersSnapshot = await db.collection('users')
    .where('role', 'in', ['member', 'owner'])
    .get();
  const totalUsers = usersSnapshot.size;
  
  // 2. 카테고리 분포
  const categoryMap = new Map<string, number>();
  placesSnapshot.docs.forEach(doc => {
    const category = doc.data().category;
    categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
  });
  
  const categoryDistribution = Array.from(categoryMap.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: (count / totalPlaces) * 100,
    }))
    .sort((a, b) => b.count - a.count);
  
  // 3. 등급 분포
  const tierMap = new Map<string, number>();
  reviewsSnapshot.docs.forEach(doc => {
    const tier = doc.data().ratingTier;
    tierMap.set(tier, (tierMap.get(tier) || 0) + 1);
  });
  
  const tierDistribution = (['S', 'A', 'B', 'C', 'F'] as const).map(tier => ({
    tier,
    count: tierMap.get(tier) || 0,
    percentage: ((tierMap.get(tier) || 0) / totalReviews) * 100,
  }));
  
  // 4. 인기 장소 TOP 10
  const statsSnapshot = await db.collection('stats')
    .orderBy('reviewCount', 'desc')
    .limit(10)
    .get();
  
  const topPlaces = await Promise.all(
    statsSnapshot.docs.map(async doc => {
      const stats = doc.data() as PlaceStats;
      const placeDoc = await db.collection('places').doc(stats.placeId).get();
      return {
        place: { id: placeDoc.id, ...placeDoc.data() } as Place,
        stats,
      };
    })
  );
  
  // 5. 최근 추가된 장소
  const recentPlacesSnapshot = await db.collection('places')
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(5)
    .get();
  const recentlyAdded = recentPlacesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as Place[];
  
  // 6. 최근 리뷰
  const recentReviewsSnapshot = await db.collection('reviews')
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  const recentReviews = recentReviewsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
  
  // 7. 재미 통계
  const mostReviewedPlace = topPlaces[0]?.place;
  
  // 평균 등급 가장 높은 곳 (리뷰 3개 이상만)
  const allStatsSnapshot = await db.collection('stats')
    .where('reviewCount', '>=', 3)
    .get();
  let highestRatedPlace: Place | undefined;
  let highestAvg = 0;
  
  for (const doc of allStatsSnapshot.docs) {
    const stats = doc.data() as PlaceStats;
    const tierValue = { S: 5, A: 4, B: 3, C: 2, F: 1 }[stats.avgTier || 'C'];
    if (tierValue > highestAvg) {
      highestAvg = tierValue;
      const placeDoc = await db.collection('places').doc(stats.placeId).get();
      highestRatedPlace = { id: placeDoc.id, ...placeDoc.data() } as Place;
    }
  }
  
  // 논란의 장소 (S와 F가 공존)
  let controversialPlace: Place | undefined;
  for (const doc of allStatsSnapshot.docs) {
    const stats = doc.data() as PlaceStats;
    if (stats.tierCounts.S > 0 && stats.tierCounts.F > 0) {
      const placeDoc = await db.collection('places').doc(stats.placeId).get();
      controversialPlace = { id: placeDoc.id, ...placeDoc.data() } as Place;
      break;
    }
  }
  
  // 숨은 맛집 (리뷰 3개 이하 + S등급)
  let hiddenGem: Place | undefined;
  const hiddenGemSnapshot = await db.collection('stats')
    .where('reviewCount', '<=', 3)
    .where('avgTier', '==', 'S')
    .limit(1)
    .get();
  if (!hiddenGemSnapshot.empty) {
    const stats = hiddenGemSnapshot.docs[0].data() as PlaceStats;
    const placeDoc = await db.collection('places').doc(stats.placeId).get();
    hiddenGem = { id: placeDoc.id, ...placeDoc.data() } as Place;
  }
  
  // 8. 월별 성장 추이
  const growthMap = new Map<string, { places: number; reviews: number }>();
  
  placesSnapshot.docs.forEach(doc => {
    const createdAt = doc.data().createdAt?.toDate();
    if (createdAt) {
      const month = createdAt.toISOString().slice(0, 7);
      const current = growthMap.get(month) || { places: 0, reviews: 0 };
      growthMap.set(month, { ...current, places: current.places + 1 });
    }
  });
  
  reviewsSnapshot.docs.forEach(doc => {
    const createdAt = doc.data().createdAt?.toDate();
    if (createdAt) {
      const month = createdAt.toISOString().slice(0, 7);
      const current = growthMap.get(month) || { places: 0, reviews: 0 };
      growthMap.set(month, { ...current, reviews: current.reviews + 1 });
    }
  });
  
  const growthData = Array.from(growthMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => a.month.localeCompare(b.month));
  
  return {
    totalPlaces,
    totalReviews,
    totalUsers,
    topPlaces,
    categoryDistribution,
    tierDistribution,
    recentlyAdded,
    recentReviews,
    mostReviewedPlace,
    highestRatedPlace: highestRatedPlace!,
    controversialPlace,
    hiddenGem,
    growthData,
  };
}
```

---

## 4. API 설계

### GET /api/stats/service
```typescript
// app/api/stats/service/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calculateServiceStats } from '@/lib/firebase/serviceStats';

export async function GET(request: NextRequest) {
  try {
    const stats = await calculateServiceStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error calculating service stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate stats' },
      { status: 500 }
    );
  }
}

// 10분 캐싱
export const revalidate = 600;
```

---

## 5. UI 구현

### 5.1 전체 통계 페이지
```tsx
// app/stats/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { ServiceStats } from '@/types';
import { Doughnut, Line } from 'react-chartjs-2';
import Link from 'next/link';

export default function ServiceStatsPage() {
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    const res = await fetch('/api/stats/service');
    const data = await res.json();
    setStats(data);
    setLoading(false);
  };

  if (loading) return <div className="p-8 text-center">통계 계산 중...</div>;
  if (!stats) return <div className="p-8 text-center">통계를 불러올 수 없습니다</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold">서비스 통계</h1>
        <p className="text-sm text-gray-600">우리의 맛집 여정</p>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* 요약 */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg shadow-lg p-6 text-white">
          <h2 className="text-3xl font-bold mb-2">
            우리가 지금까지 {stats.totalPlaces}곳을 발굴했습니다! 🎉
          </h2>
          <p className="text-lg opacity-90">
            {stats.totalUsers}명이 함께 {stats.totalReviews}개의 리뷰를 남겼어요
          </p>
        </div>

        {/* 인기 장소 TOP 10 */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">🔥 인기 장소 TOP 10</h2>
          <div className="space-y-2">
            {stats.topPlaces.map((item, idx) => (
              <Link
                key={item.place.placeId}
                href={`/places/${item.place.placeId}`}
                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-400">#{idx + 1}</span>
                  <div>
                    <div className="font-bold">{item.place.name}</div>
                    <div className="text-sm text-gray-600">
                      {item.place.category} · {item.place.address}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">
                    {item.stats.avgTier || '?'}등급
                  </div>
                  <div className="text-sm text-gray-600">
                    리뷰 {item.stats.reviewCount}개
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 카테고리 분포 */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">📊 카테고리별 분포</h2>
          <div className="max-w-md mx-auto">
            <Doughnut
              data={{
                labels: stats.categoryDistribution.map(c => c.category),
                datasets: [
                  {
                    data: stats.categoryDistribution.map(c => c.count),
                    backgroundColor: [
                      '#FF6384',
                      '#36A2EB',
                      '#FFCE56',
                      '#4BC0C0',
                      '#9966FF',
                      '#FF9F40',
                    ],
                  },
                ],
              }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {stats.categoryDistribution.map(cat => (
              <div key={cat.category} className="text-sm">
                <span className="font-semibold">{cat.category}</span>
                <span className="text-gray-600 ml-2">
                  {cat.count}개 ({cat.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 등급 분포 */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">⭐ 평가 등급 분포</h2>
          <div className="space-y-3">
            {stats.tierDistribution.map(tier => (
              <div key={tier.tier} className="flex items-center gap-3">
                <div className="w-12 text-center font-bold">{tier.tier}</div>
                <div className="flex-1 bg-gray-200 rounded-full h-6">
                  <div
                    className={`h-full rounded-full ${getTierColor(tier.tier)}`}
                    style={{ width: `${tier.percentage}%` }}
                  />
                </div>
                <div className="w-24 text-right text-sm">
                  {tier.count}개 ({tier.percentage.toFixed(1)}%)
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 재미 통계 */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">🎲 재미있는 통계</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {stats.mostReviewedPlace && (
              <HighlightCard
                title="가장 핫한 곳"
                icon="🔥"
                place={stats.mostReviewedPlace}
                description="리뷰가 가장 많아요"
              />
            )}
            {stats.highestRatedPlace && (
              <HighlightCard
                title="최고 평점"
                icon="⭐"
                place={stats.highestRatedPlace}
                description="평균 등급이 가장 높아요"
              />
            )}
            {stats.controversialPlace && (
              <HighlightCard
                title="논란의 장소"
                icon="💥"
                place={stats.controversialPlace}
                description="S와 F가 공존하는 곳"
              />
            )}
            {stats.hiddenGem && (
              <HighlightCard
                title="숨은 맛집"
                icon="💎"
                place={stats.hiddenGem}
                description="리뷰는 적지만 S등급"
              />
            )}
          </div>
        </section>

        {/* 성장 추이 */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">📈 월별 성장 추이</h2>
          <Line
            data={{
              labels: stats.growthData.map(d => d.month),
              datasets: [
                {
                  label: '장소',
                  data: stats.growthData.map(d => d.places),
                  borderColor: '#3B82F6',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                },
                {
                  label: '리뷰',
                  data: stats.growthData.map(d => d.reviews),
                  borderColor: '#10B981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                },
              ],
            }}
          />
        </section>

        {/* 최근 활동 */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">🆕 최근 추가된 장소</h2>
          <div className="space-y-2">
            {stats.recentlyAdded.map(place => (
              <Link
                key={place.placeId}
                href={`/places/${place.placeId}`}
                className="block p-3 hover:bg-gray-50 rounded-lg"
              >
                <div className="font-bold">{place.name}</div>
                <div className="text-sm text-gray-600">
                  {place.category} · {place.createdAt?.toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function getTierColor(tier: string) {
  const colors: Record<string, string> = {
    S: 'bg-purple-500',
    A: 'bg-blue-500',
    B: 'bg-green-500',
    C: 'bg-orange-500',
    F: 'bg-red-500',
  };
  return colors[tier] || 'bg-gray-500';
}

function HighlightCard({ title, icon, place, description }: any) {
  return (
    <Link
      href={`/places/${place.placeId}`}
      className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 hover:bg-blue-50"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-bold text-lg">{title}</div>
      <div className="text-xl font-bold mt-1">{place.name}</div>
      <div className="text-sm text-gray-600 mt-1">{description}</div>
    </Link>
  );
}
```

---

## 6. 구현 체크리스트

### Phase 1: 백엔드 (0.5일)
- [ ] types/index.ts에 ServiceStats 추가
- [ ] lib/firebase/serviceStats.ts 생성
  - [ ] calculateServiceStats()
- [ ] API: GET /api/stats/service

### Phase 2: UI (0.5일)
- [ ] app/stats/page.tsx
  - [ ] 요약 카드
  - [ ] 인기 장소 TOP 10
  - [ ] 카테고리 도넛 차트
  - [ ] 등급 분포 바
  - [ ] 재미 통계 카드
  - [ ] 성장 추이 라인 차트
  - [ ] 최근 추가 리스트
- [ ] HighlightCard 컴포넌트

### 테스트
- [ ] 통계 계산 정확성
- [ ] 차트 렌더링
- [ ] 링크 동작

---

## 7. 테스트 시나리오

### 시나리오 1: 통계 조회
1. `/stats` 접속
2. ✅ "우리가 지금까지 120곳을 발굴했습니다"
3. ✅ 모든 차트 렌더링
4. ✅ TOP 10 리스트

### 시나리오 2: 재미 통계
1. "숨은 맛집" 카드 확인
2. 클릭 → 해당 장소 상세 페이지
3. ✅ 정상 이동

---

## 참고 문서
- FEATURE_IDEAS.md Phase 3.2
- CHECKLIST.md S섹션
- Chart.js 문서
