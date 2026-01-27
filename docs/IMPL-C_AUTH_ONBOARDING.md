# C. 인증 + 온보딩 (닉네임 게이트)

## 목표
Google 로그인 → 닉네임 설정 → 역할 기반 접근 제어

## 구현 완료 ✅

### 1. Firebase Auth 설정
**파일**: `lib/firebase/auth.ts`
- `signInWithGoogle()`: Google OAuth 로그인
- `signOut()`: 로그아웃
- `onAuthStateChanged()`: 인증 상태 리스너

### 2. AuthContext
**파일**: `contexts/AuthContext.tsx`
- `firebaseUser`: Firebase User 객체
- `user`: Firestore users 문서 (uid, nickname, role, createdAt 등)
- `loading`: 로딩 상태
- `useAuth()` 훅으로 전역 접근

### 3. 로그인 페이지
**파일**: `app/login/page.tsx`
- Google Sign-In 버튼
- 로그인 성공 시 → 사용자 문서 확인
  - 없으면: `users/{uid}` 생성 (role=pending)
  - 있으면: 홈으로 이동

### 4. 닉네임 온보딩
**파일**: `app/onboarding/nickname/page.tsx`
- 닉네임 입력 폼
- 검증 규칙:
  - 길이: 2~10자
  - 허용: 한글, 영문, 숫자
  - 금칙어: (필요시 추가)
- 저장 후 홈(`/`)으로 이동

### 5. NicknameGate 가드
**파일**: `components/guards/NicknameGate.tsx`
- `app/layout.tsx`에서 전역 적용
- 로그인했지만 닉네임 없으면 `/onboarding/nickname`으로 리다이렉트
- pending/guest/member/owner 모두 통과

### 6. 역할 기반 UI 제어
**예시** (`app/page.tsx`):
```tsx
const { user } = useAuth();
const isMemberOrOwner = user?.role === 'member' || user?.role === 'owner';

{isMemberOrOwner && (
  <Link href="/add">장소 추가</Link>
)}
```

## 핵심 흐름
1. 미로그인 → `/login` 유도
2. Google 로그인 → `users/{uid}` 생성 (role=pending)
3. 닉네임 없음 → `/onboarding/nickname` 강제 리다이렉트
4. 닉네임 입력 → 저장 → `/` 홈
5. 관리자가 pending → member 승인 (`/admin/users`)

## 체크포인트
- [x] Google 로그인 후 Firestore에 user 문서 생성
- [x] 닉네임 없는 사용자는 온보딩 페이지로 리다이렉트
- [x] AuthContext로 전역 인증 상태 접근
- [x] pending/member/owner 역할 구분

## 참고 문서
- [REF_AUTH_ROLES.md](REF_AUTH_ROLES.md) - 역할 시스템 상세
- [02_DATA_MODEL.md](02_DATA_MODEL.md) - users 컬렉션 스키마
- [IMPL-D_SECURITY_RULES.md](IMPL-D_SECURITY_RULES.md) - Firestore 보안 규칙
