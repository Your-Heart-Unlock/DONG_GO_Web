# IMPL-Q: 리더보드 ("우리끼리 셀럽")

> **우선순위**: P2 (재미 요소)  
> **예상 소요**: 2일  
> **관련 섹션**: CHECKLIST.md Q섹션, FEATURE_IDEAS.md Phase 2.2

---

## 1. 개요 및 목표

### 컨셉
"우리끼리 셀럽" - 폐쇄형 지인 커뮤니티에서 활동 경쟁과 재미 요소

### 목표
- 활동 점수 기반 리더보드
- 1/2/3위 강조 (👑🥈🥉)
- 주간/월간 MVP, 특별 타이틀
- 내 순위 확인 및 전주 대비 변동

### 성공 지표
- 리더보드가 리뷰 작성 동기 부여
- 순위 경쟁이 긍정적 분위기 유지
- 특별 타이틀로 재미 증가

---

## 2. 데이터 모델

### LeaderboardEntry 인터페이스
```typescript
// types/index.ts에 추가
export interface LeaderboardEntry {
  uid: string;
  nickname: string;
  profileImage?: string;
  
  // 점수
  totalPoints: number;
  breakdown: {
    reviewPoints: number; // 리뷰 * 10
    placePoints: number; // 장소 추가 * 20
    bonusPoints: number; // S등급 * 5
  };
  
  // 통계
  totalReviews: number;
  totalPlacesAdded: number;
  totalSGrades: number;
  
  // 순위
  rank: number;
  rankChange: number; // 전주 대비 (양수=상승, 음수=하락)
  
  // 타이틀
  badges: string[]; // ["이번 주 MVP", "맛집 발굴왕"]
  
  // 날짜
  lastActive: Date; // 마지막 활동
}

// 주간 스냅샷 (순위 변동 추적용)
export interface WeeklySnapshot {
  snapshotId: string;
  weekStart: Date; // 월요일 00:00
  weekEnd: Date; // 일요일 23:59
  rankings: {
    uid: string;
    rank: number;
    points: number;
  }[];
  createdAt: Date;
}
```

### User 문서 확장
```typescript
export interface User {
  // ... 기존 필드
  
  // 리더보드용
  points: number; // 현재 점수 (캐싱)
  lastRank: number; // 지난주 순위
  badges: string[]; // 획득한 뱃지들
}
```

---

## 3. 점수 계산 시스템

### 점수 규칙
```typescript
// lib/firebase/leaderboard.ts (신규)
export const POINTS_CONFIG = {
  REVIEW: 10, // 리뷰 작성
  PLACE_ADD: 20, // 장소 추가
  S_GRADE: 5, // S등급 보너스
  A_GRADE: 3, // A등급 보너스
  PHOTO: 2, // 사진 포함 보너스 (나중에)
};

/**
 * 사용자 점수 계산
 */
export async function calculateUserPoints(uid: string): Promise<number> {
  // 리뷰 개수
  const reviewsSnapshot = await db.collection('reviews')
    .where('uid', '==', uid)
    .get();
  const reviewsCount = reviewsSnapshot.size;
  
  // S/A등급 개수
  let sCount = 0;
  let aCount = 0;
  reviewsSnapshot.docs.forEach(doc => {
    const tier = doc.data().ratingTier;
    if (tier === 'S') sCount++;
    if (tier === 'A') aCount++;
  });
  
  // 장소 추가 개수
  const placesSnapshot = await db.collection('places')
    .where('createdBy', '==', uid)
    .get();
  const placesCount = placesSnapshot.size;
  
  // 총점 계산
  const points =
    reviewsCount * POINTS_CONFIG.REVIEW +
    placesCount * POINTS_CONFIG.PLACE_ADD +
    sCount * POINTS_CONFIG.S_GRADE +
    aCount * POINTS_CONFIG.A_GRADE;
  
  return points;
}

/**
 * 전체 리더보드 생성
 */
export async function generateLeaderboard(): Promise<LeaderboardEntry[]> {
  // 모든 member/owner 가져오기
  const usersSnapshot = await db.collection('users')
    .where('role', 'in', ['member', 'owner'])
    .get();
  
  const entries: LeaderboardEntry[] = [];
  
  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    const uid = user.uid;
    
    // 점수 계산
    const points = await calculateUserPoints(uid);
    
    // 통계
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
    
    // 마지막 활동 (최근 리뷰 날짜)
    const lastReviewSnapshot = await db.collection('reviews')
      .where('uid', '==', uid)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    const lastActive = lastReviewSnapshot.empty
      ? new Date(0)
      : lastReviewSnapshot.docs[0].data().createdAt.toDate();
    
    entries.push({
      uid,
      nickname: user.nickname,
      profileImage: user.profileImage,
      totalPoints: points,
      breakdown: {
        reviewPoints: reviewsCount * POINTS_CONFIG.REVIEW,
        placePoints: placesCount * POINTS_CONFIG.PLACE_ADD,
        bonusPoints: sCount * POINTS_CONFIG.S_GRADE,
      },
      totalReviews: reviewsCount,
      totalPlacesAdded: placesCount,
      totalSGrades: sCount,
      rank: 0, // 아래에서 계산
      rankChange: 0, // 아래에서 계산
      badges: [],
      lastActive,
    });
  }
  
  // 점수순 정렬
  entries.sort((a, b) => b.totalPoints - a.totalPoints);
  
  // 순위 부여
  entries.forEach((entry, index) => {
    entry.rank = index + 1;
  });
  
  // 전주 순위와 비교
  const lastWeekSnapshot = await getLastWeekSnapshot();
  if (lastWeekSnapshot) {
    entries.forEach(entry => {
      const lastWeekRank = lastWeekSnapshot.rankings.find(
        r => r.uid === entry.uid
      )?.rank || 999;
      entry.rankChange = lastWeekRank - entry.rank; // 양수=상승
    });
  }
  
  // 특별 타이틀 부여
  assignBadges(entries);
  
  return entries;
}

/**
 * 특별 타이틀 부여
 */
function assignBadges(entries: LeaderboardEntry[]) {
  if (entries.length === 0) return;
  
  // 1위 = 이번 주 MVP
  if (entries[0]) {
    entries[0].badges.push('👑 이번 주 MVP');
  }
  
  // 리뷰 가장 많이 쓴 사람
  const maxReviews = Math.max(...entries.map(e => e.totalReviews));
  const reviewKing = entries.find(e => e.totalReviews === maxReviews);
  if (reviewKing && !reviewKing.badges.includes('👑 이번 주 MVP')) {
    reviewKing.badges.push('📝 리뷰왕');
  }
  
  // 장소 가장 많이 추가한 사람
  const maxPlaces = Math.max(...entries.map(e => e.totalPlacesAdded));
  const placeKing = entries.find(e => e.totalPlacesAdded === maxPlaces);
  if (placeKing && maxPlaces > 0) {
    placeKing.badges.push('🗺️ 맛집 발굴왕');
  }
  
  // S등급 가장 많이 준 사람
  const maxS = Math.max(...entries.map(e => e.totalSGrades));
  const sKing = entries.find(e => e.totalSGrades === maxS);
  if (sKing && maxS > 0) {
    sKing.badges.push('⭐ 까다로운 심사위원');
  }
  
  // 가장 많이 오른 사람
  const maxRise = Math.max(...entries.map(e => e.rankChange));
  if (maxRise > 0) {
    const riseKing = entries.find(e => e.rankChange === maxRise);
    if (riseKing) {
      riseKing.badges.push(`🚀 급상승 (↑${maxRise})`);
    }
  }
}

/**
 * 주간 스냅샷 저장
 */
export async function saveWeeklySnapshot() {
  const entries = await generateLeaderboard();
  
  const snapshot: WeeklySnapshot = {
    snapshotId: `snapshot-${Date.now()}`,
    weekStart: getThisMonday(),
    weekEnd: getThisSunday(),
    rankings: entries.map(e => ({
      uid: e.uid,
      rank: e.rank,
      points: e.totalPoints,
    })),
    createdAt: new Date(),
  };
  
  await db.collection('leaderboard_snapshots').doc(snapshot.snapshotId).set(snapshot);
}

// 헬퍼 함수들
function getThisMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff));
}

function getThisSunday() {
  const monday = getThisMonday();
  return new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
}

async function getLastWeekSnapshot() {
  const lastMonday = new Date(getThisMonday());
  lastMonday.setDate(lastMonday.getDate() - 7);
  
  const snapshot = await db.collection('leaderboard_snapshots')
    .where('weekStart', '==', lastMonday)
    .limit(1)
    .get();
  
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as WeeklySnapshot;
}
```

---

## 4. API 설계

### GET /api/leaderboard
```typescript
// app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateLeaderboard } from '@/lib/firebase/leaderboard';

export async function GET(request: NextRequest) {
  try {
    const leaderboard = await generateLeaderboard();
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error('Error generating leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to generate leaderboard' },
      { status: 500 }
    );
  }
}

// 캐싱 (5분)
export const revalidate = 300;
```

---

## 5. UI 구현

### 5.1 리더보드 페이지
```tsx
// app/leaderboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LeaderboardEntry } from '@/types';
import Link from 'next/link';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    setLeaderboard(data.leaderboard);
    
    if (user) {
      const my = data.leaderboard.find((e: LeaderboardEntry) => e.uid === user.uid);
      setMyEntry(my || null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b p-4">
        <h1 className="text-2xl font-bold">🏆 리더보드</h1>
        <p className="text-sm text-gray-600">우리끼리 셀럽 랭킹</p>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* TOP 3 */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {leaderboard.slice(0, 3).map((entry, idx) => (
            <TopCard key={entry.uid} entry={entry} rank={idx + 1} />
          ))}
        </div>

        {/* 4위 이하 */}
        <div className="bg-white rounded-lg shadow divide-y">
          {leaderboard.slice(3).map(entry => (
            <LeaderCard key={entry.uid} entry={entry} />
          ))}
        </div>

        {/* 내 순위 (고정) */}
        {myEntry && myEntry.rank > 3 && (
          <div className="fixed bottom-4 left-4 right-4 max-w-4xl mx-auto">
            <div className="bg-blue-500 text-white rounded-lg shadow-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-2xl font-bold">#{myEntry.rank}</span>
                  <span className="ml-2">{myEntry.nickname} (나)</span>
                </div>
                <div className="text-right">
                  <div className="font-bold">{myEntry.totalPoints}점</div>
                  {myEntry.rankChange !== 0 && (
                    <div className="text-sm">
                      {myEntry.rankChange > 0
                        ? `↑${myEntry.rankChange}`
                        : `↓${Math.abs(myEntry.rankChange)}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TopCard({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const medals = ['👑', '🥈', '🥉'];
  const colors = [
    'from-yellow-400 to-yellow-600',
    'from-gray-300 to-gray-500',
    'from-orange-400 to-orange-600',
  ];

  return (
    <div className={`bg-gradient-to-br ${colors[rank - 1]} rounded-lg shadow-lg p-4 text-white`}>
      <div className="text-center">
        <div className="text-4xl mb-2">{medals[rank - 1]}</div>
        <div className="font-bold text-lg mb-1">{entry.nickname}</div>
        <div className="text-2xl font-bold">{entry.totalPoints}점</div>
        <div className="text-sm opacity-90 mt-2">
          리뷰 {entry.totalReviews}개 · S등급 {entry.totalSGrades}개
        </div>
        {entry.rankChange !== 0 && (
          <div className="text-sm mt-1">
            {entry.rankChange > 0
              ? `↑${entry.rankChange}`
              : `↓${Math.abs(entry.rankChange)}`}
          </div>
        )}
        {entry.badges.length > 0 && (
          <div className="mt-2 text-xs opacity-90">
            {entry.badges[0]}
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderCard({ entry }: { entry: LeaderboardEntry }) {
  return (
    <div className="p-4 hover:bg-gray-50">
      <div className="flex items-center gap-4">
        {/* 순위 */}
        <div className="text-2xl font-bold text-gray-400 w-12">
          #{entry.rank}
        </div>

        {/* 프로필 */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold">{entry.nickname}</span>
            {entry.badges.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                {entry.badges[0]}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600">
            리뷰 {entry.totalReviews}개 · 장소 {entry.totalPlacesAdded}개 · S등급 {entry.totalSGrades}개
          </div>
        </div>

        {/* 점수 */}
        <div className="text-right">
          <div className="text-xl font-bold">{entry.totalPoints}점</div>
          {entry.rankChange !== 0 && (
            <div className={`text-sm ${
              entry.rankChange > 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {entry.rankChange > 0
                ? `↑${entry.rankChange}`
                : `↓${Math.abs(entry.rankChange)}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 5.2 홈 화면 위젯
```tsx
// app/page.tsx에 추가
export default function HomePage() {
  const [topUsers, setTopUsers] = useState<LeaderboardEntry[]>([]);
  
  useEffect(() => {
    fetchTopUsers();
  }, []);
  
  const fetchTopUsers = async () => {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    setTopUsers(data.leaderboard.slice(0, 3));
  };
  
  return (
    <div>
      {/* 지도 */}
      <NaverMapView />
      
      {/* 위젯 */}
      <div className="absolute top-20 right-4 bg-white rounded-lg shadow-lg p-3 w-48">
        <h3 className="font-bold text-sm mb-2">👑 이번 주 TOP 3</h3>
        <div className="space-y-1">
          {topUsers.map((user, idx) => (
            <div key={user.uid} className="flex items-center justify-between text-sm">
              <span>
                {['👑', '🥈', '🥉'][idx]} {user.nickname}
              </span>
              <span className="text-gray-500">{user.totalPoints}점</span>
            </div>
          ))}
        </div>
        <Link
          href="/leaderboard"
          className="block mt-2 text-center text-xs text-blue-600 hover:underline"
        >
          전체 보기 →
        </Link>
      </div>
    </div>
  );
}
```

---

## 6. 자동화

### 주간 스냅샷 (Vercel Cron Job)
```typescript
// app/api/cron/weekly-snapshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveWeeklySnapshot } from '@/lib/firebase/leaderboard';

export async function GET(request: NextRequest) {
  // Vercel Cron Secret 검증
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  await saveWeeklySnapshot();
  return NextResponse.json({ success: true });
}
```

```json
// vercel.json에 추가
{
  "crons": [
    {
      "path": "/api/cron/weekly-snapshot",
      "schedule": "0 0 * * 1"
    }
  ]
}
```

---

## 7. 구현 체크리스트

### Phase 1: 백엔드 (1일)
- [ ] types/index.ts에 LeaderboardEntry, WeeklySnapshot 추가
- [ ] lib/firebase/leaderboard.ts 생성
  - [ ] calculateUserPoints()
  - [ ] generateLeaderboard()
  - [ ] assignBadges()
  - [ ] saveWeeklySnapshot()
- [ ] API: GET /api/leaderboard
- [ ] Cron: 주간 스냅샷 저장

### Phase 2: UI (1일)
- [ ] app/leaderboard/page.tsx
  - [ ] TopCard (TOP 3)
  - [ ] LeaderCard (4위 이하)
  - [ ] 내 순위 고정 표시
- [ ] 홈 화면 위젯
- [ ] 프로필에서 리더보드 링크

### 테스트
- [ ] 점수 계산 정확성
- [ ] 순위 변동 추적
- [ ] 특별 타이틀 부여
- [ ] 주간 스냅샷 저장

---

## 8. 테스트 시나리오

### 시나리오 1: 리더보드 조회
1. `/leaderboard` 접속
2. ✅ TOP 3가 크게 표시
3. ✅ 4위 이하 리스트
4. ✅ 내 순위 하단 고정

### 시나리오 2: 순위 변동
1. 리뷰 작성으로 점수 증가
2. 다음 주 월요일에 스냅샷 저장
3. ✅ "↑2" 표시

### 시나리오 3: 특별 타이틀
1. 리뷰 가장 많이 쓴 사용자
2. ✅ "📝 리뷰왕" 뱃지 부여

---

## 참고 문서
- FEATURE_IDEAS.md Phase 2.2
- CHECKLIST.md Q섹션
