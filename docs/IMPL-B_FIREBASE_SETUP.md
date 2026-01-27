# Firebase 설정 가이드

이 문서는 Firebase 프로젝트 생성부터 로컬/Vercel 환경변수 설정까지 전체 과정을 안내합니다.

---

## 1. Firebase Console 설정

### 1-1. 프로젝트 생성
1. https://console.firebase.google.com/ 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: `dong-go-web`)
4. Google 애널리틱스는 선택사항 (나중에 추가 가능)
5. "프로젝트 만들기" 클릭

### 1-2. 웹 앱 등록
1. 프로젝트 개요 화면에서 웹 아이콘(`</>`) 클릭
2. 앱 닉네임 입력 (예: `dong-go-web`)
3. Firebase Hosting 체크 안 함 (Vercel 사용)
4. "앱 등록" 클릭
5. **firebaseConfig 값들을 복사해둡니다** (나중에 환경변수로 사용)

### 1-3. Authentication 활성화
1. 좌측 메뉴 "Authentication" → "시작하기"
2. "Sign-in method" 탭
3. "Google" 선택 → "사용 설정" 토글 ON
4. 프로젝트 지원 이메일 선택
5. "저장"

### 1-4. Firestore Database 생성
1. 좌측 메뉴 "Firestore Database" → "데이터베이스 만들기"
2. **프로덕션 모드**로 시작 (Rules는 나중에 직접 설정)
3. 위치 선택:
   - `asia-northeast3` (Seoul) - 추천
   - `asia-northeast1` (Tokyo) - 대안
4. "사용 설정"

### 1-5. Storage 활성화
1. 좌측 메뉴 "Storage" → "시작하기"
2. **프로덕션 모드**로 시작
3. 위치는 Firestore와 동일하게 선택 권장
4. "완료"

### 1-6. Admin SDK 키 생성 (서버용)
1. 좌측 상단 톱니바퀴(⚙️) → "프로젝트 설정"
2. "서비스 계정" 탭
3. "새 비공개 키 생성" 클릭
4. JSON 파일 다운로드
   - **주의: 이 파일은 절대 Git에 커밋하지 말 것!**
   - `.gitignore`에 이미 `service-account-key.json` 추가되어 있음

---

## 2. 로컬 환경변수 설정

### 2-1. `.env.local` 파일 수정

프로젝트 루트의 `.env.local` 파일을 열어서 실제 값으로 교체:

```bash
# Firebase Console > 프로젝트 설정 > 일반 > SDK 설정 및 구성에서 복사
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop
```

### 2-2. Admin SDK 설정 (두 가지 방법 중 선택)

#### 방법 A: JSON 파일 사용 (로컬 개발용 - 간편)
1. 다운로드한 `service-account-key.json` 파일을 프로젝트 루트에 복사
2. `.gitignore`에 이미 추가되어 있어서 Git에 커밋되지 않음
3. `lib/firebase/admin.ts`가 자동으로 이 파일을 감지하여 사용

#### 방법 B: 환경변수 사용 (Vercel과 동일한 방식)
다운로드한 JSON 파일을 열어서 값 추출:

```json
{
  "project_id": "your-project-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
}
```

`.env.local`에 추가:

```bash
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...(전체 키)...\n-----END PRIVATE KEY-----\n"
```

**주의:** Private Key는 반드시 큰따옴표로 감싸고, `\n`은 그대로 유지

### 2-3. 로컬 테스트

```bash
# 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:3000 접속
# 로그인 테스트
```

---

## 3. Naver Maps API 설정

### 3-1. Naver Cloud Platform 설정
1. https://www.ncloud.com/ 접속 및 회원가입
2. Console > Services > AI·NAVER API > Application 등록
3. Application 이름 입력
4. **Web Dynamic Map** 선택
5. 서비스 URL 입력:
   - 로컬: `http://localhost:3000`
   - Vercel: `https://your-app.vercel.app`
6. "등록" 클릭
7. **Client ID 복사**

### 3-2. 환경변수 추가

`.env.local`에 추가:

```bash
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=your_naver_client_id
```

---

## 4. Vercel 환경변수 설정

### 4-1. Vercel 프로젝트 연결
1. https://vercel.com 접속
2. GitHub 저장소 연결
3. 프로젝트 생성

### 4-2. 환경변수 입력
1. Vercel Dashboard > 프로젝트 선택 > Settings > Environment Variables
2. 아래 환경변수들을 **하나씩** 추가:

#### Firebase Client SDK (모두 추가)
```
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 123456789012
NEXT_PUBLIC_FIREBASE_APP_ID = 1:123456789012:web:abc...
```

#### Firebase Admin SDK
```
FIREBASE_ADMIN_PROJECT_ID = your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL = firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

**주의사항:**
- `FIREBASE_ADMIN_PRIVATE_KEY`는 따옴표 없이 입력
- `\n`은 그대로 유지 (실제 줄바꿈이 아님)
- Vercel UI에서 여러 줄로 보이더라도 정상

#### Naver Maps
```
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID = your_naver_client_id
```

### 4-3. 환경변수 적용 범위
- Production ✅
- Preview ✅
- Development (선택사항)

### 4-4. 재배포
환경변수 추가 후 자동으로 재배포되거나, "Redeploy" 버튼 클릭

---

## 5. Firebase 도메인 승인 (Vercel 배포 후)

### 5-1. Vercel 도메인 추가
1. Vercel 배포 후 도메인 확인 (예: `your-app.vercel.app`)
2. Firebase Console > Authentication > Settings > Authorized domains
3. "도메인 추가" 클릭
4. Vercel 도메인 입력 (예: `your-app.vercel.app`)
5. "추가" 클릭

커스텀 도메인 사용 시 해당 도메인도 추가

---

## 6. 설정 검증

### 6-1. 로컬 검증
```bash
npm run dev
```

1. http://localhost:3000 접속
2. 로그인 버튼 클릭 → Google 로그인 팝업 확인
3. 로그인 성공 → 닉네임 설정 화면
4. 닉네임 설정 → 메인 화면 (지도)
5. Firebase Console > Firestore > users 컬렉션에 사용자 생성 확인

### 6-2. Vercel 검증
1. Vercel 배포 URL 접속
2. 동일한 플로우 테스트
3. 브라우저 콘솔에 에러 없는지 확인

### 6-3. 네이버 지도 검증
1. 메인 페이지에 지도 표시되는지 확인
2. "지도 로드 실패" 에러가 없는지 확인

---

## 7. 트러블슈팅

### Firebase Auth 에러
```
Error: auth/invalid-api-key
```
→ `.env.local`의 `NEXT_PUBLIC_FIREBASE_API_KEY` 값 확인

### Firestore 권한 에러
```
Error: Missing or insufficient permissions
```
→ Firestore Rules가 아직 배포되지 않았을 수 있음 (나중에 D 섹션에서 배포)

### Naver Maps 로드 실패
```
Failed to load Naver Maps SDK
```
→ `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID` 확인
→ Naver Cloud Platform에서 도메인 승인 확인

### Admin SDK 에러
```
Error: Could not load the default credentials
```
→ `FIREBASE_ADMIN_PRIVATE_KEY`의 `\n` 확인
→ Vercel에서 따옴표 없이 입력했는지 확인

### Private Key 형식 (Vercel)
올바른 형식:
```
-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANB...(생략)...xyz\n-----END PRIVATE KEY-----\n
```

잘못된 형식:
```
"-----BEGIN PRIVATE KEY-----\n...  (따옴표 포함)
```

---

## 8. 보안 체크리스트

- [x] `.env.local` 파일이 `.gitignore`에 포함되어 있음
- [x] `service-account-key.json`이 Git에 커밋되지 않음
- [ ] Firebase Console에서 Authorized domains 설정 완료
- [x] Firestore Rules 배포 완료 (섹션 D에서 진행)
- [x] Storage Rules 배포 완료 (섹션 D에서 진행)

---

## 9. 다음 단계

설정 완료 후:
1. **섹션 D: Firestore Rules 배포** - pending/guest 권한 제한
2. **섹션 J: Admin Import** - `/initial_data/` JSON 파일 가져오기
3. **섹션 F: 장소 상세 페이지** - 실제 장소 데이터 표시

---

## 참고 링크

- Firebase Console: https://console.firebase.google.com/
- Naver Cloud Platform: https://console.ncloud.com/
- Vercel Dashboard: https://vercel.com/dashboard
