# Firebase Storage 배포 가이드

## 1. Firebase CLI 설치 확인
```bash
firebase --version
```

만약 설치되어 있지 않다면:
```bash
npm install -g firebase-tools
```

## 2. Firebase 로그인
```bash
firebase login
```

## 3. Firebase 프로젝트 초기화 (처음 한 번만)
```bash
firebase init
```
- Storage 선택
- 기존 프로젝트 선택: dong-go
- storage.rules 파일 경로: storage.rules (기본값)

## 4. Storage 규칙만 배포
```bash
firebase deploy --only storage
```

## 5. 배포 확인
Firebase Console에서 확인:
https://console.firebase.google.com/project/dong-go/storage/rules

## 문제 해결
만약 "No project active" 오류가 나면:
```bash
firebase use dong-go
```
