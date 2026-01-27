# IMPL-V: PWA (Progressive Web App)

## 개요
동고(DONG-GO) 웹 서비스를 Progressive Web App으로 변환하여 모바일 기기에서 앱처럼 사용할 수 있도록 합니다. 홈 화면에 추가, 오프라인 지원, 빠른 로딩 등의 기능을 제공합니다.

**예상 소요 시간**: 1d  
**우선순위**: P6 (선택 기능)  
**의존성**: 없음 (독립적)

## PWA 핵심 요소

### 1. Web App Manifest
앱 아이콘, 이름, 색상 등 앱의 외관을 정의합니다.

### 2. Service Worker
오프라인 캐싱, 백그라운드 동기화를 담당합니다.

### 3. HTTPS
PWA는 HTTPS에서만 동작합니다 (Vercel 기본 제공).

## 구현

### Web App Manifest

```json
// public/manifest.json
{
  "name": "동고 (DONG-GO) - 우리들의 맛집 지도",
  "short_name": "동고",
  "description": "친구들과 함께하는 폐쇄형 맛집 공유 서비스",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#9333EA",
  "orientation": "portrait-primary",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/home.png",
      "sizes": "540x720",
      "type": "image/png",
      "form_factor": "narrow"
    },
    {
      "src": "/screenshots/map.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    }
  ],
  "categories": ["food", "social", "lifestyle"],
  "shortcuts": [
    {
      "name": "지도 보기",
      "short_name": "지도",
      "description": "맛집 지도 바로가기",
      "url": "/",
      "icons": [{ "src": "/icons/map-shortcut.png", "sizes": "96x96" }]
    },
    {
      "name": "장소 추가",
      "short_name": "추가",
      "description": "새 맛집 추가하기",
      "url": "/add",
      "icons": [{ "src": "/icons/add-shortcut.png", "sizes": "96x96" }]
    },
    {
      "name": "내 프로필",
      "short_name": "프로필",
      "description": "내 프로필 보기",
      "url": "/me",
      "icons": [{ "src": "/icons/profile-shortcut.png", "sizes": "96x96" }]
    }
  ],
  "related_applications": [],
  "prefer_related_applications": false
}
```

### Service Worker

```javascript
// public/sw.js
const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `donggo-cache-${CACHE_VERSION}`;

// 오프라인에서도 동작할 핵심 리소스
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// API 요청 캐시 전략
const API_CACHE_TIME = 5 * 60 * 1000; // 5분

// Install: 정적 리소스 캐싱
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  
  // 즉시 활성화
  self.skipWaiting();
});

// Activate: 오래된 캐시 삭제
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('donggo-cache-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  
  // 즉시 클라이언트 제어
  self.clients.claim();
});

// Fetch: 네트워크 우선, 실패 시 캐시 (Network First)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API 요청: Stale-While-Revalidate
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 정적 리소스: Cache First
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML 페이지: Network First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // 기타: Network First
  event.respondWith(networkFirst(request));
});

// Network First: 네트워크 우선, 실패 시 캐시
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    
    // 200번대 응답만 캐싱
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    
    if (cached) {
      console.log('[SW] Serving from cache:', request.url);
      return cached;
    }
    
    // 오프라인 페이지 반환
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    
    throw error;
  }
}

// Cache First: 캐시 우선, 없으면 네트워크
async function cacheFirst(request) {
  const cached = await caches.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    throw error;
  }
}

// Stale-While-Revalidate: 캐시 즉시 반환 + 백그라운드 업데이트
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  // 백그라운드에서 최신 데이터 가져오기
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  
  // 캐시가 있으면 즉시 반환, 없으면 네트워크 대기
  return cached || fetchPromise;
}

// Push Notification (알림 시스템 연동)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const options = {
    body: data.message || '새로운 알림이 도착했습니다',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.link || '/',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: '열기'
      },
      {
        action: 'close',
        title: '닫기'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || '동고', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const url = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 이미 열린 탭이 있으면 포커스
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background Sync (오프라인 작업 동기화)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reviews') {
    event.waitUntil(syncReviews());
  }
});

async function syncReviews() {
  // IndexedDB에서 오프라인 리뷰 가져와서 서버에 전송
  console.log('[SW] Syncing offline reviews...');
  // 구현 생략 (추후 확장)
}
```

### Service Worker 등록

```typescript
// lib/pwa/registerServiceWorker.ts
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered:', registration.scope);

      // 업데이트 확인
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // 새 버전 사용 가능
            console.log('New service worker available');
            showUpdateNotification();
          }
        });
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

function showUpdateNotification() {
  // 사용자에게 업데이트 알림
  if (confirm('새 버전이 있습니다. 페이지를 새로고침하시겠습니까?')) {
    window.location.reload();
  }
}
```

### Root Layout 수정

```typescript
// app/layout.tsx
import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: '동고 (DONG-GO) - 우리들의 맛집 지도',
  description: '친구들과 함께하는 폐쇄형 맛집 공유 서비스',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '동고',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: '동고 (DONG-GO)',
    title: '동고 - 우리들의 맛집 지도',
    description: '친구들과 함께하는 폐쇄형 맛집 공유 서비스',
  },
  twitter: {
    card: 'summary',
    title: '동고 (DONG-GO)',
    description: '우리들의 맛집 지도',
  },
};

export const viewport: Viewport = {
  themeColor: '#9333EA',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/icons/icon-120.png" />
        
        {/* Safari Pinned Tab */}
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#9333EA" />
        
        {/* MS Tile */}
        <meta name="msapplication-TileColor" content="#9333EA" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </head>
      <body>
        <PWAProvider>
          {children}
        </PWAProvider>
      </body>
    </html>
  );
}
```

### PWA Provider (Service Worker 등록 + Install Prompt)

```typescript
// components/PWAProvider.tsx
'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker } from '@/lib/pwa/registerServiceWorker';

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Service Worker 등록
    registerServiceWorker();

    // Install Prompt 이벤트 리스닝
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // 이미 설치된 경우 프롬프트 표시 안함
      if (!isStandalone()) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 앱 설치 완료 이벤트
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  function isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    );
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`User response to install prompt: ${outcome}`);
    
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  }

  function handleDismiss() {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  }

  return (
    <>
      {children}
      
      {/* Install Prompt Banner */}
      {showInstallPrompt && (
        <div className="fixed bottom-0 left-0 right-0 bg-purple-600 text-white p-4 shadow-lg z-50">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="font-semibold">앱처럼 사용하기</div>
              <div className="text-sm text-purple-100">
                홈 화면에 추가하고 빠르게 접속하세요
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDismiss}
                className="px-4 py-2 text-sm font-medium hover:bg-purple-700 rounded"
              >
                나중에
              </button>
              <button
                onClick={handleInstallClick}
                className="px-4 py-2 text-sm font-medium bg-white text-purple-600 rounded hover:bg-purple-50"
              >
                설치
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

### Offline 페이지

```typescript
// app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <div className="text-6xl mb-6">📡</div>
      <h1 className="text-3xl font-bold mb-4">오프라인 상태입니다</h1>
      <p className="text-gray-600 mb-8">
        인터넷 연결을 확인하고 다시 시도해주세요.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700"
      >
        다시 시도
      </button>
    </div>
  );
}
```

### BrowserConfig (MS Tile)

```xml
<!-- public/browserconfig.xml -->
<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/icons/icon-150.png"/>
      <TileColor>#9333EA</TileColor>
    </tile>
  </msapplication>
</browserconfig>
```

## 아이콘 생성

### 아이콘 사이즈

PWA에 필요한 아이콘 사이즈:
- 72x72, 96x96, 120x120, 128x128, 144x144, 152x152, 180x180, 192x192, 384x384, 512x512

### 아이콘 생성 도구

1. **온라인 도구**: [PWA Builder](https://www.pwabuilder.com/) - 한 번에 모든 사이즈 생성
2. **Figma/Photoshop**: 512x512 마스터 파일에서 리사이즈
3. **ImageMagick** (CLI):
```bash
convert icon-512.png -resize 192x192 icon-192.png
```

### Maskable Icon

Android Adaptive Icons를 위한 Maskable 버전:
- 중요한 콘텐츠를 중앙 80%에 배치
- 외곽 20%는 잘릴 수 있음
- [Maskable.app](https://maskable.app/)에서 테스트

## next.config.ts 수정

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // PWA 관련 헤더
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

## 체크리스트

### Manifest & Icons (0.3d)
- [ ] `/public/manifest.json` 생성
  - [ ] name, short_name, description
  - [ ] icons (72~512px, maskable 포함)
  - [ ] start_url, display, theme_color
  - [ ] shortcuts (지도/추가/프로필)
- [ ] 아이콘 생성 (10개 사이즈)
- [ ] Apple Touch Icons
- [ ] browserconfig.xml (MS Tile)

### Service Worker (0.4d)
- [ ] `/public/sw.js` 생성
- [ ] Install 이벤트 (정적 리소스 캐싱)
- [ ] Activate 이벤트 (오래된 캐시 삭제)
- [ ] Fetch 이벤트 (캐싱 전략)
  - [ ] Network First (HTML, API)
  - [ ] Cache First (이미지, 폰트)
  - [ ] Stale-While-Revalidate (API)
- [ ] Offline 페이지 fallback
- [ ] Push notification 핸들러
- [ ] Background sync 핸들러 (선택)

### 프론트엔드 (0.3d)
- [ ] registerServiceWorker.ts
- [ ] PWAProvider 컴포넌트
  - [ ] Service Worker 등록
  - [ ] Install Prompt 리스닝
  - [ ] 설치 배너 표시
- [ ] `/offline` 페이지
- [ ] layout.tsx에 메타데이터 추가
- [ ] next.config.ts 헤더 설정

## 테스트 시나리오

### 1. 설치 (Android)
```
1. Chrome에서 사이트 방문
2. 주소창 오른쪽에 "설치" 아이콘 표시
3. 클릭하여 설치
4. 홈 화면에 아이콘 생성
5. 앱처럼 전체 화면으로 실행
```

### 2. 설치 (iOS)
```
1. Safari에서 사이트 방문
2. 공유 버튼 → "홈 화면에 추가"
3. 이름 확인 후 추가
4. 홈 화면에 아이콘 생성
5. Standalone 모드로 실행
```

### 3. 오프라인 동작
```
1. 사이트 방문 (Service Worker 설치)
2. 네트워크 끄기
3. 새로고침 또는 다른 페이지 이동
4. 캐시된 페이지 표시 (오프라인 배너)
5. 네트워크 복구 시 자동 재연결
```

### 4. 업데이트
```
1. 새 버전 배포 (sw.js 버전 변경)
2. 기존 사용자 방문 시 백그라운드 업데이트
3. "새 버전 사용 가능" 알림
4. 새로고침하여 업데이트 적용
```

### 5. Lighthouse 검사
```
1. Chrome DevTools → Lighthouse 탭
2. "Progressive Web App" 카테고리 체크
3. "Generate report" 실행
4. 점수 90점 이상 목표
  - Fast and reliable (오프라인 동작)
  - Installable (manifest.json 유효)
  - PWA optimized (메타태그, 아이콘)
```

## Lighthouse PWA 체크리스트

### 필수 요구사항 (90점 이상)
- [x] HTTPS 사용 (Vercel 기본)
- [ ] manifest.json 유효
- [ ] Service Worker 등록
- [ ] 오프라인 동작 (200 응답)
- [ ] 아이콘 192x512px
- [ ] viewport meta 태그
- [ ] theme-color 설정

### 추가 개선사항
- [ ] Maskable icon 제공
- [ ] Shortcuts 정의
- [ ] 빠른 로딩 (< 3초)
- [ ] 모바일 최적화
- [ ] 접근성 (a11y)

## 보안 고려사항

1. **HTTPS 필수**: Service Worker는 HTTPS에서만 동작
2. **캐시 보안**: 민감한 API 응답은 캐싱 제외
3. **Service Worker Scope**: `/sw.js` 위치가 scope 결정
4. **버전 관리**: CACHE_VERSION으로 캐시 무효화
5. **XSS 방지**: manifest.json의 start_url 검증

## 추후 개선 아이디어

1. **Background Sync**: 오프라인 리뷰 작성 후 자동 동기화
2. **Periodic Background Sync**: 정기적 데이터 갱신
3. **Share Target**: 다른 앱에서 동고로 공유
4. **File Handling**: 이미지 파일 열기
5. **Shortcuts**: 동적 shortcuts 업데이트
6. **Badge API**: 미읽음 알림 개수를 앱 아이콘에 표시
7. **Web Share API**: 장소/리뷰 공유 기능
8. **Screen Wake Lock**: 지도 볼 때 화면 꺼짐 방지

## 참고 자료

- [PWA Builder](https://www.pwabuilder.com/)
- [Web.dev - PWA](https://web.dev/progressive-web-apps/)
- [MDN - Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Maskable Icon Editor](https://maskable.app/)
- [Manifest Generator](https://www.simicart.com/manifest-generator.html/)
