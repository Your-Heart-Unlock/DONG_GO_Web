# 훈동이 맛집 지도 (DONG_GO_Web)

폐쇄형 맛집 공유 서비스 - 지인끼리 함께 사용하는 맛집 큐레이션 플랫폼

## 프로젝트 개요

- **목적**: 우리끼리 공유하는 맛집 지도 (네이버 북마크 import + 직접 추가)
- **스택**: Next.js 15 (App Router) + TypeScript + Firebase + Naver Maps API + Kakao Search API
- **배포**: Vercel

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경변수 설정

`.env.local` 파일을 프로젝트 루트에 생성:

```bash
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (서버 전용)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Naver Maps
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=

# Kakao Search API
KAKAO_REST_API_KEY=
```

상세 설정 가이드: [`docs/IMPL-B_FIREBASE_SETUP.md`](docs/IMPL-B_FIREBASE_SETUP.md)

### 3. 개발 서버 실행

```bash
npm run dev
```

## 프로젝트 구조

```
DONG_GO_Web/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 전역 레이아웃 (AuthProvider + NicknameGate)
│   ├── page.tsx            # 메인 페이지 (지도 + 마커 + 바텀시트)
│   ├── login/              # Google 로그인
│   ├── onboarding/         # 닉네임 설정
│   │   └── nickname/
│   ├── places/             # 장소 상세 (/places/[placeId])
│   ├── add/                # 장소 추가 (카카오 검색 기반)
│   ├── admin/              # 관리자 콘솔
│   │   ├── page.tsx        # 대시보드
│   │   ├── import/         # 네이버 북마크 JSON import
│   │   ├── users/          # 사용자 관리 (pending → member 승인)
│   │   ├── places/         # 장소 관리
│   │   └── security-test/  # 보안 규칙 테스트
│   └── api/                # API Routes
├── components/
│   ├── guards/             # 권한 가드 (NicknameGate, OwnerGuard)
│   ├── map/                # 지도 (NaverMapView, PlaceBottomSheet, SearchBar)
│   └── reviews/            # 리뷰 (ReviewCard, ReviewForm, ReviewList)
├── contexts/               # AuthContext
├── lib/
│   ├── firebase/           # Firebase 클라이언트/서버 (auth, user, places, reviews, admin)
│   ├── naver/              # 네이버 지도 SDK 로더 (useNaverMaps)
│   ├── admin/              # Admin 유틸 (importParser)
│   └── utils/              # 공통 유틸 (cellId 그리드)
├── types/                  # TypeScript 타입 정의
├── docs/                   # 프로젝트 스펙 & 구현 가이드
└── initial_data/           # 초기 데이터 (네이버 북마크 JSON)
```

## 주요 기능

### 역할 기반 접근 제어
- **owner**: 관리자 (1명) - 모든 관리 기능
- **member**: 승인된 사용자 - 장소/리뷰 추가 가능
- **pending**: 가입 대기 - 통계만 조회
- **guest**: 비로그인 - 통계만 조회

### 구현 완료

1. **인증 & 온보딩**: Google 로그인 → 닉네임 설정 → 역할 부여
2. **지도 메인**: 네이버 지도 + 마커 + 바텀시트 미리보기
   - cellId 그리드 기반 bounds 쿼리 (Firestore 읽기 비용 최적화)
   - 줌 아웃 시 마커 자동 숨김 + 뷰포트 밖 마커 숨김
   - 클라이언트 캐싱 (placeId + cellId 이중 캐시)
3. **장소 상세**: 기본 정보 + 통계 + 리뷰 목록 + 네이버/카카오 지도 링크
4. **장소 추가**: 카카오 검색 → placeId 중복 체크 → 네이버 ID 매칭
5. **리뷰 시스템**: S/A/B/C/F 티어 평가 + 태그 + 한줄평 + 방문 정보
6. **보안 규칙**: Firestore/Storage Rules + /admin/security-test 검증
7. **Admin Console**: 대시보드 + 사용자 승인 + 네이버 북마크 import

### 미구현/진행 중
- 마커 클러스터링
- 검색/필터 기능
- 사진 업로드
- 요청 시스템 (수정/삭제 요청)
- 위시리스트, 리더보드, 뱃지 등 확장 기능

## 개발 규칙

1. **문서 기준 개발**: `/docs/` 폴더의 스펙 문서를 기준으로 함
2. **권한 강제**: pending/guest 제한은 UI + Firestore Rules 양쪽에서 강제
3. **삭제 금지**: Hard delete 대신 hidden/deleted 플래그 사용
4. **중복 방지**: placeId 기반 장소 중복 방지
5. **Import 안전**: Preview → Commit 2단계로 진행

## 스크립트

```bash
npm run dev          # 개발 서버 실행
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 실행
npm run lint         # ESLint 실행
npm run type-check   # TypeScript 타입 체크
```

## 문서

상세한 스펙은 `/docs/` 폴더 참고. 문서 구조: [`docs/README.md`](docs/README.md)

- **기초 문서**: `00_OVERVIEW.md`, `01_TECH_STACK.md`, `02_DATA_MODEL.md`, `03_ROUTING.md`
- **구현 가이드**: `IMPL-A` ~ `IMPL-V` (체크리스트 항목별 상세 가이드)
- **참고 문서**: `REF_AUTH_ROLES.md`, `REF_RATING_SYSTEM.md`, `REF_MAP_STRATEGY.md` 등
- **체크리스트**: [`docs/CHECKLIST.md`](docs/CHECKLIST.md) - MVP 진행 현황

## License

Private Project
