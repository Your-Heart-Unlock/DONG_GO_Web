# Tech Stack & Deployment

## Frontend
- Next.js (React)
- TypeScript
- 배포: Vercel

## Backend (BaaS)
- Firebase
  - Firestore (DB)
  - Firebase Auth (Google Sign-In)
  - Firebase Storage (사진)

## Map
- 네이버 지도 JavaScript API
- placeId 기반 장소 관리 (중복 방지)

## Mobile
- 모바일 웹 반응형 필수
- 하단 탭 중심 UI
- 앱 배포는 하지 않음
- PWA는 선택 사항 (스플래시 불필요)

## 서버 정책
- 별도 서버 운영 없음
- 모든 권한/검증은 Firestore Rules + 클라이언트 로직
