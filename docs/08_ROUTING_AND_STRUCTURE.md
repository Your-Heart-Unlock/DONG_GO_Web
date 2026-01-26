# Routing & Project Structure (Next.js App Router)

목표:
- 에이전트가 바로 개발에 들어갈 수 있도록, Next.js(App Router) 기반의
  "라우팅 맵 + 폴더 구조 + Guard 정책 + 데이터 접근 규칙"을 고정한다.

스택:
- Next.js (App Router)
- Firebase (Auth/Firestore/Storage)
- Naver Maps JS SDK
- 배포: Vercel

---

## 1) 라우팅 맵 (MVP 고정)

### 1.1 Public/User Routes
| Route | Page | 목적 |
|------|------|------|
| `/` | Map Home | 지도 + 검색 + 마커 + 바텀시트 |
| `/places/[placeId]` | Place Detail | 상세 페이지 (권한에 따라 내용 차등) |
| `/add` | Add Place | 네이버 검색 기반 장소 추가 |
| `/me` | My Activity | 내 리뷰/방문 기록 관리 |
| `/login` | Login | Google 로그인 |
| `/onboarding/nickname` | Nickname Gate | 닉네임 강제 설정 |

> `/` 에서 모든 사용자가 검색/탐색 가능.  
> pending/guest도 `/places/[placeId]` 접근 가능(B 정책)하지만, 민감 데이터는 rules로 차단.

### 1.2 Admin Routes (owner only)
| Route | Page | 목적 |
|------|------|------|
| `/admin` | Admin Dashboard | 현황 요약 + 단축 액션 |
| `/admin/requests` | Requests | 수정/삭제 요청 처리 |
| `/admin/import` | Import | JSON import (dry-run → commit) |
| `/admin/users` | Users | pending 승인 + role 관리 |
| `/admin/places` | Places Admin | 검색 + hide/unhide |
| `/admin/settings` | Settings | rating label mapping 편집 |

---

## 2) 권한/가드 정책 (라우팅 수준)

### 2.1 Auth State
- guest: 비로그인
- pending/member/owner: 로그인 + `users/{uid}` 문서 기반

### 2.2 Nickname Gate (강제 온보딩)
규칙:
- 로그인은 했는데 `users/{uid}.nickname` 없으면
  어떤 페이지에 있든 `/onboarding/nickname`로 redirect
- 단, `/login`과 `/onboarding/nickname` 자체는 예외

### 2.3 Admin Gate
규칙:
- `/admin/**`는 `role == owner`만 접근
- 미충족 시 `/` redirect 또는 403

### 2.4 Pending/Guest 제한(B 정책)
- `/places/[placeId]` 접근은 허용
- 단, pending/guest는 다음을 "데이터 레벨"에서 차단:
  - `reviews` 읽기 불가
  - `visits` 읽기 불가
  - 사진(Storage) URL 획득/다운로드 불가
- 대신 `places/{placeId}`와 `places/{placeId}/stats`는 읽기 허용
- UI는 권한에 따라 "통계만" 보여주도록 분기

---

## 3) 추천 폴더 구조 (App Router 기준)

app/
├─ layout.tsx                  # 전역 레이아웃
├─ page.tsx                    # "/" 지도 홈

├─ login/
│  └─ page.tsx                 # Google 로그인

├─ onboarding/
│  └─ nickname/
│     └─ page.tsx              # 닉네임 강제 설정

├─ places/
│  └─ [placeId]/
│     └─ page.tsx              # 장소 상세 페이지

├─ add/
│  └─ page.tsx                 # 장소 추가 (네이버 검색)

├─ me/
│  └─ page.tsx                 # 내 리뷰 / 방문 기록

├─ admin/
│  ├─ layout.tsx               # Admin 전용 레이아웃 + Owner Guard
│  ├─ page.tsx                 # Admin Dashboard
│  ├─ requests/
│  │  └─ page.tsx              # 수정/삭제 요청 처리
│  ├─ import/
│  │  └─ page.tsx              # JSON Import (Dry-run → Commit)
│  ├─ users/
│  │  └─ page.tsx              # Pending 승인 / Role 관리
│  ├─ places/
│  │  └─ page.tsx              # 장소 검색 + Hide/Unhide
│  └─ settings/
│     └─ page.tsx              # 평가 라벨 매핑 설정

components/
├─ guards/
│  ├─ NicknameGate.tsx         # 닉네임 필수 가드
│  └─ OwnerGuard.tsx           # 관리자(owner) 가드

├─ shell/
│  ├─ AppShell.tsx             # 공용 레이아웃 (헤더 + 바텀탭)
│  ├─ Header.tsx
│  ├─ BottomTab.tsx
│  └─ AdminNav.tsx             # 관리자 네비게이션

├─ map/
│  ├─ NaverMapView.tsx         # 네이버 지도 렌더링
│  ├─ SearchBar.tsx            # 지도 검색 입력
│  ├─ PlaceBottomSheet.tsx     # 마커 클릭 시 바텀시트
│  └─ MarkerLayer.tsx

├─ place/
│  ├─ PlaceHeader.tsx          # 장소 기본 정보
│  ├─ PlaceStatsPanel.tsx      # 통계 패널 (guest/pending 가능)
│  ├─ PlaceMemberSection.tsx   # member 전용 (리뷰/방문/사진)
│  └─ PlaceLockedSection.tsx   # pending/guest 잠금 안내

├─ review/
│  ├─ ReviewList.tsx
│  └─ ReviewEditor.tsx

└─ visit/
   ├─ VisitList.tsx
   └─ VisitEditor.tsx

lib/
├─ firebase/
│  ├─ client.ts                # Firebase 초기화
│  ├─ auth.ts                  # 로그인 / 로그아웃
│  ├─ user.ts                  # users/{uid} 처리
│  ├─ places.ts                # 장소 CRUD
│  ├─ stats.ts                 # 통계 read/update
│  ├─ reviews.ts               # 리뷰 CRUD
│  ├─ visits.ts                # 방문 CRUD
│  └─ requests.ts              # 요청 생성 / 승인

├─ naver/
│  ├─ maps.ts                  # 지도 초기화
│  └─ search.ts                # 네이버 장소 검색 래퍼

└─ utils/
   ├─ format.ts
   └─ validators.ts

types/
└─ index.ts                    # 공통 타입 정의

---

## 4) 페이지별 데이터 접근 계약 (MVP)

### `/` (Map Home)
- 읽기:
  - places: 일부(최근 N개, 또는 검색 결과 기반)
  - stats: 바텀시트에서 선택적으로 placeId별 조회
- 쓰기: 없음

### `/places/[placeId]` (Place Detail)
- 항상 읽기:
  - `places/{placeId}`
  - `places/{placeId}/stats`
- member/owner만 읽기:
  - `reviews` (placeId filter)
  - `visits` (placeId filter)
  - photos(Storage + metadata)
- member/owner만 쓰기:
  - 리뷰/방문 생성/수정/삭제(본인만)
  - stats 업데이트(트랜잭션 또는 서버/함수 방식)

### `/add` (Add Place)
- 네이버 검색 → place 선택(placeId 확보)
- 쓰기:
  - placeId 없으면 `places/{placeId}` create
  - 있으면 create 하지 않음(중복 방지)
- 접근:
  - member/owner만 허용 (pending/guest는 버튼 비활성/redirect)

### `/me` (My Activity)
- member/owner만:
  - 내 visits/reviews 목록 조회(uid filter)
  - 내 컨텐츠 편집

### `/admin/**`
- owner만:
  - users read/update(role)
  - requests read/update(status)
  - places update(status hide/unhide)
  - config write
  - import 실행(places batch write)
  - admin_logs write

---

## 5) UI Shell 계약 (모바일 중심)

### 기본 Shell
- `AppShell`이 모든 public/user 페이지를 감싼다.
- 상단: Header(검색창은 `/`에서만)
- 하단: BottomTab (MVP: `지도(/)`, `추가(/add)`, `내기록(/me)`)

> 리스트 탭은 MVP에서 제외. (필요하면 나중에 `/list` 추가)

### Admin Shell
- `admin/layout.tsx`에서 AdminNav 제공
- 모바일에서는 상단 드롭다운/햄버거로 섹션 이동

---

## 6) 구현 주의사항(실수 방지)
- pending/guest가 리뷰를 "안 보게" 하는 것이 아니라,
  **Firestore rules로 "못 읽게"** 해야 한다.
- Storage 역시 pending/guest가 사진 URL을 얻지 못하게:
  - 사진 메타데이터(Firestore) read 차단
  - Storage read는 최소 "로그인만"으로 두되, pending에게 메타 자체를 안 내려준다.
- nickname gate는 "페이지별"이 아니라 앱 전역에서 강제하는 편이 안전하다.
