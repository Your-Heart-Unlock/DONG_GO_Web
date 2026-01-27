# IMPL-U: 알림 시스템 (Notification System)

## 개요
친구들의 활동(새 장소 추가, 리뷰 작성, 순위 변동)을 실시간으로 알려주는 알림 시스템을 구현합니다. 폐쇄형 커뮤니티에서 서로의 활동을 쉽게 파악하고 참여를 유도합니다.

**예상 소요 시간**: 1d  
**우선순위**: P5 (운영 편의)  
**의존성**: C섹션(인증), Q섹션(리더보드), H섹션(리뷰)

## 데이터 모델

### Firestore Collections

#### `notifications/{notificationId}`
```typescript
interface Notification {
  notificationId: string;      // 문서 ID
  uid: string;                 // 알림 받을 유저
  type: NotificationType;      // 알림 타입
  
  // 알림 내용
  title: string;               // "새로운 맛집이 추가되었어요!"
  message: string;             // "철수님이 강남역 파스타집을 추가했습니다"
  link?: string;               // 클릭 시 이동 경로 (예: /places/abc123)
  
  // 메타 정보
  createdAt: Timestamp;
  read: boolean;               // 읽음 여부
  readAt?: Timestamp;          // 읽은 시각
  
  // 추가 데이터
  actorUid?: string;           // 액션을 한 유저 (선택)
  actorNickname?: string;      // 알림 메시지 생성용
  actorProfileImage?: string;
  relatedPlaceId?: string;     // 관련 장소
  relatedReviewId?: string;    // 관련 리뷰
}

type NotificationType = 
  | 'new_place'          // 새 장소 추가됨
  | 'friend_review'      // 친구가 리뷰 작성
  | 'place_visited'      // 내가 위시한 장소를 누가 방문
  | 'rank_change'        // 리더보드 순위 변동
  | 'badge_earned'       // 뱃지 획득
  | 'reply'              // 댓글 (추후 확장)
  | 'mention'            // 멘션 (추후 확장)
  | 'system';            // 시스템 공지
```

**인덱스**:
- `uid, read, createdAt DESC` (미읽음 알림 조회)
- `uid, createdAt DESC` (전체 알림 조회)

## API Routes

### GET `/api/notifications`
**권한**: member/owner

```typescript
// app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20');

    let query = adminDb
      .collection('notifications')
      .where('uid', '==', decoded.uid);

    if (unreadOnly) {
      query = query.where('read', '==', false);
    }

    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const notifications = snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate().toISOString()
    }));

    // 미읽음 개수
    const unreadCount = unreadOnly 
      ? notifications.length
      : await adminDb
          .collection('notifications')
          .where('uid', '==', decoded.uid)
          .where('read', '==', false)
          .count()
          .get()
          .then(snap => snap.data().count);

    return NextResponse.json({ 
      notifications,
      unreadCount 
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json({ error: 'Failed to get notifications' }, { status: 500 });
  }
}
```

### POST `/api/notifications/[notificationId]/read`
**권한**: owner (본인 알림만)

```typescript
// app/api/notifications/[notificationId]/read/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { notificationId: string } }
) {
  try {
    const token = req.headers.get('authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const { notificationId } = params;

    const notifRef = adminDb.collection('notifications').doc(notificationId);
    const notif = await notifRef.get();

    if (!notif.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 본인 알림만 읽음 처리
    if (notif.data()?.uid !== decoded.uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await notifRef.update({
      read: true,
      readAt: admin.firestore.Timestamp.now()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
```

### POST `/api/notifications/read-all`
**권한**: member/owner

```typescript
// app/api/notifications/read-all/route.ts
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);

    // 미읽음 알림 일괄 업데이트
    const unreadSnapshot = await adminDb
      .collection('notifications')
      .where('uid', '==', decoded.uid)
      .where('read', '==', false)
      .get();

    const batch = adminDb.batch();
    unreadSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        read: true,
        readAt: admin.firestore.Timestamp.now()
      });
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true,
      count: unreadSnapshot.size 
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    return NextResponse.json({ error: 'Failed to mark all as read' }, { status: 500 });
  }
}
```

## 알림 생성 함수

### 헬퍼 함수

```typescript
// lib/notifications/createNotification.ts
import { adminDb } from '@/lib/firebase/admin';
import admin from 'firebase-admin';

interface CreateNotificationParams {
  uids: string[];              // 받을 유저 목록
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  actorUid?: string;
  actorNickname?: string;
  actorProfileImage?: string;
  relatedPlaceId?: string;
  relatedReviewId?: string;
}

export async function createNotification(params: CreateNotificationParams) {
  const {
    uids,
    type,
    title,
    message,
    link,
    actorUid,
    actorNickname,
    actorProfileImage,
    relatedPlaceId,
    relatedReviewId
  } = params;

  const batch = adminDb.batch();
  const now = admin.firestore.Timestamp.now();

  for (const uid of uids) {
    // 자기 자신에게는 알림 보내지 않음
    if (actorUid && uid === actorUid) continue;

    const notificationId = adminDb.collection('notifications').doc().id;
    const notifRef = adminDb.collection('notifications').doc(notificationId);

    batch.set(notifRef, {
      notificationId,
      uid,
      type,
      title,
      message,
      link,
      actorUid,
      actorNickname,
      actorProfileImage,
      relatedPlaceId,
      relatedReviewId,
      createdAt: now,
      read: false
    });
  }

  await batch.commit();
}

// 전체 멤버 uid 조회
export async function getAllMemberUids(): Promise<string[]> {
  const snapshot = await adminDb
    .collection('users')
    .where('role', 'in', ['member', 'owner'])
    .get();

  return snapshot.docs.map(doc => doc.id);
}
```

### 리뷰 작성 시 알림

```typescript
// app/api/reviews/route.ts 수정
import { createNotification, getAllMemberUids } from '@/lib/notifications/createNotification';

export async function POST(req: NextRequest) {
  // ... 기존 리뷰 생성 로직 ...

  // 알림 생성
  const memberUids = await getAllMemberUids();
  const place = await adminDb.collection('places').doc(placeId).get();
  const placeName = place.data()?.name || '맛집';

  await createNotification({
    uids: memberUids,
    type: 'friend_review',
    title: '새로운 리뷰가 작성되었어요!',
    message: `${nickname}님이 ${placeName}에 리뷰를 남겼습니다`,
    link: `/places/${placeId}`,
    actorUid: decoded.uid,
    actorNickname: nickname,
    relatedPlaceId: placeId,
    relatedReviewId: reviewId
  });

  return NextResponse.json({ reviewId });
}
```

### 장소 추가 시 알림

```typescript
// app/api/places/route.ts 수정
export async function POST(req: NextRequest) {
  // ... 기존 장소 추가 로직 ...

  const memberUids = await getAllMemberUids();

  await createNotification({
    uids: memberUids,
    type: 'new_place',
    title: '새로운 맛집이 추가되었어요!',
    message: `${nickname}님이 ${placeName}을 추가했습니다`,
    link: `/places/${placeId}`,
    actorUid: decoded.uid,
    actorNickname: nickname,
    relatedPlaceId: placeId
  });

  return NextResponse.json({ placeId });
}
```

### 순위 변동 알림 (Vercel Cron)

```typescript
// app/api/cron/weekly-rank-update/route.ts
export async function GET(req: NextRequest) {
  // ... 리더보드 스냅샷 생성 ...

  // 순위 변동 계산 및 알림
  const snapshot = await adminDb
    .collection('leaderboard_snapshots')
    .orderBy('createdAt', 'desc')
    .limit(2)
    .get();

  if (snapshot.size < 2) return; // 첫 주차는 비교 불가

  const [current, previous] = snapshot.docs.map(doc => doc.data());

  for (const entry of current.entries) {
    const prevEntry = previous.entries.find((e: any) => e.uid === entry.uid);
    if (!prevEntry) continue;

    const rankChange = prevEntry.rank - entry.rank; // 양수면 순위 상승

    if (rankChange > 0) {
      // 순위 상승 알림
      await createNotification({
        uids: [entry.uid],
        type: 'rank_change',
        title: '순위가 올랐어요! 🎉',
        message: `${rankChange}계단 상승하여 ${entry.rank}위가 되었습니다!`,
        link: '/leaderboard'
      });
    } else if (rankChange < 0) {
      // 순위 하락 알림
      await createNotification({
        uids: [entry.uid],
        type: 'rank_change',
        title: '순위가 내려갔어요 😢',
        message: `${Math.abs(rankChange)}계단 하락하여 ${entry.rank}위가 되었습니다`,
        link: '/leaderboard'
      });
    }
  }

  return NextResponse.json({ success: true });
}
```

## UI Components

### NotificationBell (헤더)

```typescript
// components/NotificationBell.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadUnreadCount();

    // 30초마다 갱신
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  async function loadUnreadCount() {
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/notifications?unreadOnly=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return null;

  return (
    <Link href="/notifications" className="relative">
      <button className="p-2 hover:bg-gray-100 rounded-full">
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    </Link>
  );
}
```

### NotificationsPage

```typescript
// app/notifications/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface Notification {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  createdAt: string;
  read: boolean;
  actorProfileImage?: string;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(notificationId: string) {
    try {
      const token = await user?.getIdToken();
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setNotifications(prev =>
        prev.map(n =>
          n.notificationId === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (err) {
      console.error(err);
    }
  }

  async function handleMarkAllRead() {
    try {
      const token = await user?.getIdToken();
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
    } catch (err) {
      console.error(err);
    }
  }

  function handleClick(notif: Notification) {
    if (!notif.read) {
      handleMarkRead(notif.notificationId);
    }
    if (notif.link) {
      router.push(notif.link);
    }
  }

  function getIcon(type: string) {
    const icons: Record<string, string> = {
      new_place: '🆕',
      friend_review: '✍️',
      place_visited: '🎉',
      rank_change: '📊',
      badge_earned: '🏆',
      system: '📢'
    };
    return icons[type] || '🔔';
  }

  function getTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return '방금 전';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}시간 전`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}일 전`;
    return date.toLocaleDateString();
  }

  if (loading) {
    return <div className="p-8">로딩 중...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">알림</h1>
        {notifications.some(n => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-purple-600 hover:underline"
          >
            모두 읽음 처리
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">🔔</div>
          <p>알림이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div
              key={notif.notificationId}
              onClick={() => handleClick(notif)}
              className={`p-4 rounded-lg border cursor-pointer hover:bg-gray-50 transition ${
                notif.read ? 'bg-white' : 'bg-purple-50 border-purple-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* 아이콘 */}
                <div className="text-2xl">
                  {getIcon(notif.type)}
                </div>

                {/* 내용 */}
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {notif.title}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {notif.message}
                  </div>
                  <div className="text-xs text-gray-400 mt-2">
                    {getTimeAgo(notif.createdAt)}
                  </div>
                </div>

                {/* 미읽음 표시 */}
                {!notif.read && (
                  <div className="w-2 h-2 bg-purple-600 rounded-full mt-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 레이아웃에 NotificationBell 추가

```typescript
// app/layout.tsx
import NotificationBell from '@/components/NotificationBell';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <header className="border-b">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <Link href="/" className="text-xl font-bold">
                동고 (DONG-GO)
              </Link>
              <div className="flex items-center gap-4">
                <NotificationBell />
                {/* 기타 헤더 버튼들 */}
              </div>
            </div>
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

## 푸시 알림 (선택 사항)

### Service Worker 설정

```typescript
// public/sw.js
self.addEventListener('push', function(event) {
  const data = event.data.json();
  
  const options = {
    body: data.message,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: {
      url: data.link || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
```

### FCM 토큰 저장

```typescript
// lib/firebase/messaging.ts
import { getMessaging, getToken } from 'firebase/messaging';

export async function requestNotificationPermission(uid: string) {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('Notification permission denied');
    return;
  }

  try {
    const messaging = getMessaging();
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
    });

    // 토큰을 users 문서에 저장
    await fetch('/api/users/fcm-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    console.log('FCM token saved:', token);
  } catch (err) {
    console.error('Error getting FCM token:', err);
  }
}
```

## 체크리스트

### 백엔드 (0.4d)
- [ ] `notifications` 컬렉션 설계 및 인덱스
- [ ] GET `/api/notifications` - 알림 목록 조회
- [ ] POST `/api/notifications/[id]/read` - 읽음 처리
- [ ] POST `/api/notifications/read-all` - 전체 읽음 처리
- [ ] createNotification() 헬퍼 함수
- [ ] getAllMemberUids() 헬퍼 함수

### 알림 트리거 (0.3d)
- [ ] 리뷰 작성 시 알림 생성 (friend_review)
- [ ] 장소 추가 시 알림 생성 (new_place)
- [ ] 순위 변동 시 알림 생성 (rank_change) - Cron
- [ ] 뱃지 획득 시 알림 생성 (badge_earned)

### 프론트엔드 (0.3d)
- [ ] NotificationBell 컴포넌트 (헤더)
- [ ] `/notifications` 페이지
  - [ ] 알림 목록 표시
  - [ ] 클릭 시 해당 페이지 이동 + 읽음 처리
  - [ ] 모두 읽음 처리 버튼
  - [ ] 시간 표시 (방금 전, N분 전)
- [ ] 레이아웃에 NotificationBell 추가

### 푸시 알림 (선택, +0.5d)
- [ ] FCM 설정 (Firebase Console)
- [ ] Service Worker 등록
- [ ] 푸시 알림 권한 요청 UI
- [ ] FCM 토큰 저장 API
- [ ] 서버에서 FCM 메시지 전송 로직

## 테스트 시나리오

### 1. 리뷰 알림
```
1. User A가 "강남역 파스타"에 리뷰 작성
2. User B, C의 알림 목록에 "A님이 강남역 파스타에 리뷰를 남겼습니다" 표시
3. User B가 알림 클릭 → /places/abc123으로 이동
4. 알림이 읽음 처리됨 (배경색 변경)
```

### 2. 장소 추가 알림
```
1. User A가 "홍대 카페" 추가
2. 모든 멤버에게 "A님이 홍대 카페를 추가했습니다" 알림
3. NotificationBell에 빨간 뱃지 (1) 표시
```

### 3. 순위 변동 알림
```
1. 매주 월요일 00시 Cron 실행
2. 리더보드 스냅샷 비교
3. User A가 3위 → 1위 상승
4. "2계단 상승하여 1위가 되었습니다! 🎉" 알림
```

### 4. 모두 읽음 처리
```
1. User A에게 미읽음 알림 5개
2. "모두 읽음 처리" 버튼 클릭
3. 5개 알림 모두 read: true로 변경
4. NotificationBell 뱃지 사라짐
```

## 보안 고려사항

1. **본인 알림만 조회**: uid 필터링
2. **본인 알림만 읽음 처리**: 권한 체크
3. **자기 자신 제외**: actorUid와 uid 비교
4. **Rate Limiting**: 알림 스팸 방지 (추후)
5. **FCM 토큰 보안**: 토큰 암호화 저장 (선택)

## 추후 개선 아이디어

1. **알림 설정**: 유저별 알림 on/off 설정
2. **알림 그룹화**: "A, B, C님이 리뷰를 작성했습니다"
3. **실시간 알림**: WebSocket/SSE로 즉시 푸시
4. **알림 필터**: 타입별 필터링 (리뷰만, 순위만)
5. **알림 소리**: 새 알림 도착 시 사운드
6. **이메일 알림**: 중요 알림은 이메일로도 전송
7. **댓글 알림**: 내 리뷰에 댓글 달리면 알림
8. **멘션 알림**: @nickname 멘션 시 알림
