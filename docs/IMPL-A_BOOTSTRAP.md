# A. 프로젝트 부트스트랩

## 목표
Next.js 14+ (App Router) + TypeScript 프로젝트 초기 설정 및 배포 환경 구성

## 구현 완료 ✅

### 1. Next.js 프로젝트 생성
```bash
npx create-next-app@latest dong-go-web --typescript --tailwind --app --no-src-dir
```

### 2. 프로젝트 구조
```
dong-go-web/
├── app/              # App Router 페이지
├── components/       # 재사용 컴포넌트
├── contexts/         # React Context
├── lib/             # 유틸리티 & Firebase
├── types/           # TypeScript 타입 정의
├── docs/            # 문서
└── public/          # 정적 파일
```

### 3. ESLint & Prettier
- `.eslintrc.json`: Next.js 기본 설정 사용
- 코드 포맷팅: Prettier (VS Code 설정)

### 4. 환경변수 구조
`.env.local` 파일:
```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (Server-side only)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Naver Map
NEXT_PUBLIC_NAVER_CLIENT_ID=

# Kakao
NEXT_PUBLIC_KAKAO_REST_API_KEY=
```

### 5. Vercel 배포
- Git 저장소 연결
- 자동 배포: main 브랜치 push 시
- 환경변수: Vercel Dashboard에서 설정

## 체크포인트
- [x] `npm run dev` 로컬 개발 서버 실행
- [x] TypeScript 타입 체크: `npm run type-check`
- [x] Vercel 배포 성공

## 참고 문서
- [01_TECH_STACK.md](01_TECH_STACK.md)
- Next.js 공식 문서: https://nextjs.org/docs
