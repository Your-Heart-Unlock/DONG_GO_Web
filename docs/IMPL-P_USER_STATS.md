# IMPL-P: 개인 통계 대시보드

> **우선순위**: P1 (핵심 기능)  
> **예상 소요**: 2일  
> **관련 섹션**: CHECKLIST.md P섹션, FEATURE_IDEAS.md Phase 2.1

---

## 1. 개요 및 목표

### 문제점
- 내가 얼마나 리뷰를 썼는지 한눈에 보기 어려움
- 내 맛집 취향을 분석한 데이터가 없음
- 친구들과 비교할 수 있는 지표가 없음

### 목표
- 개인 활동 통계 대시보드 (`/me/stats`)
- 리뷰 수, 방문 장소 수, 평균 등급 등
- 카테고리별 취향 분석
- 시간별 활동 추이 (월별 리뷰 수)
- 그룹 내 랭킹

### 성공 지표
- 통계 페이지에서 내 활동을 한눈에 파악
- 차트로 시각화되어 직관적
- "까다로운 미식가" 같은 취향 프로필 제공

---

## 2. 데이터 모델

### UserStats 인터페이스
```typescript
// types/index.ts에 추가
export interface UserStats {
  uid: string;
  
  // 기본 통계
  totalReviews: number;
  totalPlacesVisited: number; // 리뷰 쓴 고유 장소 수
  averageTier: number; // 평균 평점 (S=5, A=4, B=3, C=2, F=1)
  
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
    avgTier: number; // 이 카테고리의 평균 등급
  }[];
  
  // 시간 분석
  reviewsByMonth: {
    month: string; // "2026-01"
    count: number;
  }[];
  mostActiveMonth: string; // "2026-01"
  longestStreak: number; // 연속 리뷰 작성 일수
  
  // 재방문 분석
  revisitRate: number; // 재방문 의도 '있음' 비율 (%)
  topRevisitPlaces: Place[]; // 재방문 의도 있는 곳
  
  // 랭킹
  rankInGroup: number; // 그룹 내 순위 (1, 2, 3, ...)
  totalPoints: number; // 활동 점수
  
  // 취향 프로필
  tasteProfile: string; // "까다로운 미식가", "폭넓은 미식가" 등
  
  // 기타
  firstReviewDate: Date;
  lastReviewDate: Date;
  placesAdded: number; // 내가 추가한 장소 수
}
```

### User 문서에 캐싱 (선택)
```typescript
// users/{uid} 문서에 stats 필드 추가 (선택사항)
export interface User {
  // ... 기존 필드
  
  stats?: {
    totalReviews: number;
    totalPlacesVisited: number;
    averageTier: number;
    lastUpdated: Date;
  };
}
```

---

## 3. 통계 계산 로직

### lib/firebase/userStats.ts (신규)
```typescript
import { db } from './admin';
import { UserStats, RatingTier } from '@/types';

/**
 * 사용자 통계 계산
 */
export async function calculateUserStats(uid: string): Promise<UserStats> {
  // 1. 사용자의 모든 리뷰 가져오기
  const reviewsSnapshot = await db.collection('reviews')
    .where('uid', '==', uid)
    .get();
  
  const reviews = reviewsSnapshot.docs.map(doc => doc.data());
  
  // 2. 기본 통계
  const totalReviews = reviews.length;
  const uniquePlaceIds = new Set(reviews.map(r => r.placeId));
  const totalPlacesVisited = uniquePlaceIds.size;
  
  // 3. 등급 분포 및 평균
  const tierValues = { S: 5, A: 4, B: 3, C: 2, F: 1 };
  const tierBreakdown = { S: 0, A: 0, B: 0, C: 0, F: 0 };
  let tierSum = 0;
  
  reviews.forEach(review => {
    const tier = review.ratingTier;
    tierBreakdown[tier]++;
    tierSum += tierValues[tier];
  });
  
  const averageTier = totalReviews > 0 ? tierSum / totalReviews : 0;
  
  // 4. 카테고리 분석
  const categoryMap = new Map<string, { count: number; tierSum: number }>();
  
  for (const review of reviews) {
    // 장소 정보 가져오기
    const placeDoc = await db.collection('places').doc(review.placeId).get();
    const place = placeDoc.data();
    
    if (place) {
      const category = place.category;
      const current = categoryMap.get(category) || { count: 0, tierSum: 0 };
      categoryMap.set(category, {
        count: current.count + 1,
        tierSum: current.tierSum + tierValues[review.ratingTier],
      });
    }
  }
  
  const topCategories = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      count: data.count,
      avgTier: data.tierSum / data.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // 5. 시간 분석
  const monthMap = new Map<string, number>();
  reviews.forEach(review => {
    const month = review.createdAt.toDate().toISOString().slice(0, 7); // "2026-01"
    monthMap.set(month, (monthMap.get(month) || 0) + 1);
  });
  
  const reviewsByMonth = Array.from(monthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
  
  const mostActiveMonth = reviewsByMonth.length > 0
    ? reviewsByMonth.reduce((max, curr) => 
        curr.count > max.count ? curr : max
      ).month
    : '';
  
  // 6. 재방문 분석
  const revisitYes = reviews.filter(r => r.revisitIntent === 'yes').length;
  const revisitRate = totalReviews > 0 ? (revisitYes / totalReviews) * 100 : 0;
  
  // 7. 장소 추가 수
  const placesSnapshot = await db.collection('places')
    .where('createdBy', '==', uid)
    .get();
  const placesAdded = placesSnapshot.size;
  
  // 8. 랭킹 계산
  const { rankInGroup, totalPoints } = await calculateRanking(uid);
  
  // 9. 취향 프로필
  const tasteProfile = getTasteProfile(averageTier, tierBreakdown, topCategories);
  
  // 10. 날짜
  const sortedReviews = reviews.sort((a, b) => 
    a.createdAt.toMillis() - b.createdAt.toMillis()
  );
  const firstReviewDate = sortedReviews[0]?.createdAt.toDate();
  const lastReviewDate = sortedReviews[sortedReviews.length - 1]?.createdAt.toDate();
  
  return {
    uid,
    totalReviews,
    totalPlacesVisited,
    averageTier,
    tierBreakdown,
    topCategories,
    reviewsByMonth,
    mostActiveMonth,
    longestStreak: 0, // TODO: 구현
    revisitRate,
    topRevisitPlaces: [], // TODO: 구현
    rankInGroup,
    totalPoints,
    tasteProfile,
    firstReviewDate,
    lastReviewDate,
    placesAdded,
  };
}

/**
 * 그룹 내 랭킹 계산
 */
async function calculateRanking(uid: string) {
  // 모든 유저의 점수 계산
  const usersSnapshot = await db.collection('users')
    .where('role', 'in', ['member', 'owner'])
    .get();
  
  const userScores = await Promise.all(
    usersSnapshot.docs.map(async doc => {
      const userUid = doc.data().uid;
      const reviewsCount = (await db.collection('reviews')
        .where('uid', '==', userUid)
        .get()
      ).size;
      
      const placesCount = (await db.collection('places')
        .where('createdBy', '==', userUid)
        .get()
      ).size;
      
      // 점수 = 리뷰 * 10 + 장소 추가 * 20
      const points = reviewsCount * 10 + placesCount * 20;
      
      return { uid: userUid, points };
    })
  );
  
  // 정렬
  userScores.sort((a, b) => b.points - a.points);
  
  // 내 순위
  const rankInGroup = userScores.findIndex(u => u.uid === uid) + 1;
  const totalPoints = userScores.find(u => u.uid === uid)?.points || 0;
  
  return { rankInGroup, totalPoints };
}

/**
 * 취향 프로필 생성
 */
function getTasteProfile(
  avgTier: number,
  tierBreakdown: any,
  topCategories: any[]
): string {
  // 평균 등급이 높으면 "까다로운 미식가"
  if (avgTier >= 4.5) {
    return '엄격한 미식가 👨‍🍳';
  }
  if (avgTier >= 4.0) {
    return '까다로운 미식가 😎';
  }
  if (avgTier >= 3.5) {
    return '균형잡힌 미식가 ⚖️';
  }
  if (avgTier >= 3.0) {
    return '폭넓은 미식가 🌈';
  }
  return '모험적인 미식가 🚀';
}
```

---

## 4. API 설계

### GET /api/users/[uid]/stats
```typescript
// app/api/users/[uid]/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { calculateUserStats } from '@/lib/firebase/userStats';

export async function GET(
  request: NextRequest,
  { params }: { params: { uid: string } }
) {
  try {
    const stats = await calculateUserStats(params.uid);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error calculating stats:', error);
    return NextResponse.json(
      { error: 'Failed to calculate stats' },
      { status: 500 }
    );
  }
}
```

---

## 5. UI 구현

### 5.1 통계 페이지
```tsx
// app/me/stats/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserStats } from '@/types';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

export default function UserStatsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    setLoading(true);
    const res = await fetch(`/api/users/${user.uid}/stats`);
    const data = await res.json();
    setStats(data);
    setLoading(false);
  };

  if (loading) {
    return <div className="p-8 text-center">통계 계산 중...</div>;
  }

  if (!stats) {
    return <div className="p-8 text-center">통계를 불러올 수 없습니다</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold">내 통계</h1>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            title="작성한 리뷰"
            value={stats.totalReviews}
            unit="개"
            icon="📝"
          />
          <StatsCard
            title="방문한 장소"
            value={stats.totalPlacesVisited}
            unit="곳"
            icon="📍"
          />
          <StatsCard
            title="평균 평점"
            value={stats.averageTier.toFixed(1)}
            unit=""
            icon="⭐"
          />
          <StatsCard
            title="그룹 순위"
            value={stats.rankInGroup}
            unit="위"
            icon="🏆"
          />
        </div>

        {/* 취향 프로필 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">나의 맛집 취향</h2>
          <div className="text-center">
            <div className="text-4xl mb-2">{stats.tasteProfile}</div>
            <p className="text-gray-600">
              평균 평점 {stats.averageTier.toFixed(1)}점 (그룹 평균 대비)
            </p>
          </div>
        </div>

        {/* 등급 분포 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">등급 분포</h2>
          <div className="max-w-md mx-auto">
            <Doughnut
              data={{
                labels: ['S', 'A', 'B', 'C', 'F'],
                datasets: [
                  {
                    data: [
                      stats.tierBreakdown.S,
                      stats.tierBreakdown.A,
                      stats.tierBreakdown.B,
                      stats.tierBreakdown.C,
                      stats.tierBreakdown.F,
                    ],
                    backgroundColor: [
                      '#9333EA', // S - Purple
                      '#2563EB', // A - Blue
                      '#16A34A', // B - Green
                      '#EA580C', // C - Orange
                      '#DC2626', // F - Red
                    ],
                  },
                ],
              }}
              options={{
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
              }}
            />
          </div>
        </div>

        {/* 카테고리별 분석 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">카테고리별 평균 등급</h2>
          <Bar
            data={{
              labels: stats.topCategories.map(c => c.category),
              datasets: [
                {
                  label: '평균 등급',
                  data: stats.topCategories.map(c => c.avgTier),
                  backgroundColor: '#3B82F6',
                },
              ],
            }}
            options={{
              scales: {
                y: {
                  beginAtZero: true,
                  max: 5,
                },
              },
            }}
          />
        </div>

        {/* 월별 활동 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">월별 리뷰 활동</h2>
          <Line
            data={{
              labels: stats.reviewsByMonth.map(m => m.month),
              datasets: [
                {
                  label: '리뷰 수',
                  data: stats.reviewsByMonth.map(m => m.count),
                  borderColor: '#3B82F6',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  fill: true,
                },
              ],
            }}
          />
          <p className="mt-4 text-sm text-gray-600 text-center">
            가장 활발했던 달: {stats.mostActiveMonth}
          </p>
        </div>

        {/* 재방문 의도 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">재방문 의도</h2>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-500">
              {stats.revisitRate.toFixed(1)}%
            </div>
            <p className="text-gray-600 mt-2">
              {stats.totalReviews}개 리뷰 중 {
                Math.round((stats.revisitRate / 100) * stats.totalReviews)
              }곳에 다시 가고 싶어해요
            </p>
          </div>
        </div>

        {/* 기타 정보 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">활동 기록</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>첫 리뷰: {stats.firstReviewDate?.toLocaleDateString()}</p>
            <p>최근 리뷰: {stats.lastReviewDate?.toLocaleDateString()}</p>
            <p>추가한 장소: {stats.placesAdded}개</p>
            <p>활동 점수: {stats.totalPoints}점</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, unit, icon }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold">
        {value}
        <span className="text-sm font-normal text-gray-600">{unit}</span>
      </div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
}
```

### 5.2 프로필에서 링크
```tsx
// app/me/page.tsx에 추가
export default function MyProfilePage() {
  return (
    <div>
      {/* 프로필 정보 */}
      
      <Link
        href="/me/stats"
        className="block bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">내 통계 보기</h3>
            <p className="text-sm text-gray-600">
              맛집 취향 분석, 활동 통계
            </p>
          </div>
          <span className="text-2xl">📊</span>
        </div>
      </Link>
    </div>
  );
}
```

---

## 6. 구현 체크리스트

### Phase 1: 백엔드 (1일)
- [ ] types/index.ts에 UserStats 인터페이스 추가
- [ ] lib/firebase/userStats.ts 생성
  - [ ] calculateUserStats() 함수
  - [ ] calculateRanking() 함수
  - [ ] getTasteProfile() 함수
- [ ] API Route: GET /api/users/[uid]/stats

### Phase 2: UI (1일)
- [ ] Chart.js 설치 및 설정
- [ ] app/me/stats/page.tsx 생성
  - [ ] 요약 카드 (4개)
  - [ ] 취향 프로필
  - [ ] 도넛 차트 (등급 분포)
  - [ ] 바 차트 (카테고리별 평균)
  - [ ] 라인 차트 (월별 활동)
  - [ ] 재방문 의도 통계
  - [ ] 기타 활동 기록
- [ ] StatsCard 컴포넌트
- [ ] 프로필 페이지에서 링크

### 테스트
- [ ] 통계 계산 정확성
- [ ] 차트 렌더링
- [ ] 랭킹 계산
- [ ] 취향 프로필 생성

---

## 7. 테스트 시나리오

### 시나리오 1: 통계 조회
1. 프로필 페이지에서 "내 통계 보기" 클릭
2. ✅ 로딩 후 통계 페이지 표시
3. ✅ 요약 카드에 정확한 수치
4. ✅ 모든 차트 정상 렌더링

### 시나리오 2: 취향 프로필
1. 평균 4.5 이상 → "엄격한 미식가"
2. 평균 4.0~4.5 → "까다로운 미식가"
3. ✅ 올바른 프로필 표시

### 시나리오 3: 랭킹
1. 3명 중 리뷰 가장 많이 쓴 사용자
2. ✅ "그룹 순위 1위" 표시

---

## 참고 문서
- FEATURE_IDEAS.md Phase 2.1
- CHECKLIST.md P섹션
- Chart.js 공식 문서
