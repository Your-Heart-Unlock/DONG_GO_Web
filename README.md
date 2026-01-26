# 훈동이 맛집 지도 (DONG_GO_Web)

폐쇄형 맛집 공유 서비스 - 지인끼리 함께 사용하는 맛집 큐레이션 플랫폼

## 프로젝트 개요

- **목적**: 네이버 지도 북마크 데이터를 기반으로 우리끼리 공유하는 맛집 지도
- **스택**: Next.js 15 (App Router) + TypeScript + Firebase + Naver Maps API
- **배포**: Vercel

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. Firebase 및 환경변수 설정

**중요: 아래 상세 가이드를 먼저 읽어주세요!**

👉 **[Firebase 설정 상세 가이드](/docs/11_FIREBASE_SETUP_GUIDE.md)** 👈

상세 가이드에서 다루는 내용:
- Firebase 프로젝트 생성 (단계별 스크린샷)
- Authentication / Firestore / Storage 활성화
- 로컬 환경변수 설정 (`.env.local`)
- Vercel 환경변수 설정
- Naver Maps API 설정
- 트러블슈팅

#### 빠른 시작 (요약)

1. `.env.local` 파일 수정:
```bash
# 프로젝트 루트의 .env.local 파일을 열어서 실제 값으로 교체
NEXT_PUBLIC_FIREBASE_API_KEY=여기에_실제_값_입력
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=여기에_실제_값_입력
# ... (나머지도 동일)
```

2. Firebase Console 작업:
   - 프로젝트 생성
   - Google Sign-In 활성화
   - Firestore/Storage 생성
   - 웹 앱 등록 → config 값 복사

3. 개발 서버 실행:
```bash
npm run dev
```

### 3. Firestore Security Rules 배포

`/docs/07_SECURITY_RULES.md` 참고하여 Firestore Rules 설정
(섹션 D에서 진행 예정)

## 프로젝트 구조

```
DONG_GO_Web/
├── app/                  # Next.js App Router
│   ├── layout.tsx       # 전역 레이아웃
│   ├── page.tsx         # 메인 페이지 (지도)
│   ├── login/           # 로그인
│   ├── onboarding/      # 닉네임 설정
│   ├── places/          # 장소 상세
│   ├── add/             # 장소 추가
│   ├── me/              # 내 활동
│   └── admin/           # 관리자 콘솔
├── components/          # 재사용 컴포넌트
│   ├── guards/         # 권한 가드
│   ├── shell/          # 레이아웃 컴포넌트
│   ├── map/            # 지도 관련
│   ├── place/          # 장소 관련
│   ├── review/         # 리뷰 관련
│   └── visit/          # 방문 기록 관련
├── lib/                 # 유틸리티 & 라이브러리
│   ├── firebase/       # Firebase 설정 & 함수
│   ├── naver/          # 네이버 지도 API
│   └── utils/          # 공통 유틸
├── types/               # TypeScript 타입 정의
├── docs/                # 프로젝트 스펙 문서
└── initial_data/        # 초기 데이터 (네이버 북마크 JSON)
```

## 주요 기능

### 역할 기반 접근 제어
- **owner**: 관리자 (1명) - 모든 관리 기능 사용 가능
- **member**: 승인된 사용자 - 장소/리뷰/방문 추가 가능
- **pending**: 가입 대기 - 통계만 조회 가능
- **guest**: 비로그인 - 통계만 조회 가능

### MVP 기능
1. **인증 & 온보딩**
   - Google 로그인
   - 닉네임 강제 설정

2. **지도 메인**
   - 네이버 지도 기반 장소 탐색
   - 검색 & 마커 표시
   - 바텀시트 미리보기

3. **장소 상세**
   - 기본 정보 (모든 사용자)
   - 통계 (모든 사용자)
   - 리뷰/방문/사진 (member 이상만)

4. **리뷰 & 방문**
   - S/A/B/C/F 티어 평가
   - 방문 기록 관리
   - 사진 업로드

5. **Admin Console (owner 전용)**
   - Dashboard: 현황 요약
   - Import: 네이버 북마크 JSON 가져오기
   - Users: pending 사용자 승인
   - Requests: 수정/삭제 요청 처리
   - Places: 장소 관리 (hide/unhide)
   - Settings: 평가 라벨 매핑 설정

## 개발 규칙

1. **문서 기준 개발**: `/docs/` 폴더의 스펙 문서를 절대 기준으로 함
2. **권한 강제**: pending/guest 제한은 UI뿐만 아니라 Firestore Rules로 강제
3. **삭제 금지**: Hard delete 대신 hidden/deleted 플래그 사용
4. **중복 방지**: placeId 기반 장소 중복 방지
5. **Import 안전**: 항상 Preview → Commit 2단계로 진행

## 스크립트

```bash
npm run dev          # 개발 서버 실행
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 실행
npm run lint         # ESLint 실행
npm run type-check   # TypeScript 타입 체크
```

## 문서

상세한 스펙은 `/docs/` 폴더 참고:
- `00_OVERVIEW.md` - 프로젝트 개요
- `01_TECH_STACK.md` - 기술 스택
- `02_AUTH_AND_ROLES.md` - 인증 & 역할
- `03_DATA_MODEL.md` - 데이터 모델
- `04_RATING_SYSTEM.md` - 평가 시스템
- `05_USER_EXPERIENCE.md` - UX 플로우
- `06_ADMIN_SPEC.md` - 관리자 콘솔
- `07_SECURITY_RULES.md` - Firestore Rules
- `08_ROUTING_AND_STRUCTURE.md` - 라우팅 구조
- `09_MVP_CHECKLIST.md` - MVP 체크리스트

## License

Private Project
