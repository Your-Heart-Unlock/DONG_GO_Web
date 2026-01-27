# MVP Implementation Checklist (Work Units)

목표: “작동하는 서비스”를 가장 빠르게 만들고, 이후 확장 가능하게 유지.

---

## A. 프로젝트 부트스트랩 (0.5~1d)
- [x] Next.js(Typescript) 프로젝트 생성
- [x] ESLint/Prettier 세팅
- [x] 환경변수 구조 확정 (Firebase config, Naver Map key)
- [x] Vercel 배포 파이프라인 연결

---

## B. Firebase 기본 세팅 (0.5d)
- [X] Firebase 프로젝트 생성 (사용자가 Firebase Console에서 수동 생성 필요)
- [X] Firestore/Storage/Auth 활성화 (사용자가 Firebase Console에서 수동 활성화 필요)
- [X] Auth: Google Sign-In 설정 (사용자가 Firebase Console에서 수동 설정 필요)
- [x] Firebase SDK 코드 준비 (client.ts, admin.ts, auth.ts, user.ts)
- [X] Firestore 컬렉션 초기 설계 반영 (03 문서 기준) - Rules 배포 시
- [ ] `config/ratings` 문서 생성(라벨 매핑 초기값) - Admin Import 구현 시

---

## C. 인증 + 온보딩(닉네임 게이트) (1d)
- [x] `/login` 페이지: Google 로그인
- [x] 로그인 후 `users/{uid}` 없으면 생성(role=pending)
- [x] `/onboarding/nickname` 구현
  - [x] 닉네임 입력/검증(길이/금칙어)
  - [x] 닉네임 저장 후 홈 이동
- [x] 공통 훅: `useAuth`, `useUserRole` (AuthContext.tsx)
- [x] pending/guest/member 상태를 클라이언트에서 인지 가능하게
- [x] NicknameGate 가드 구현 (전역 레이아웃 적용)

---

## D. 권한/보안 규칙 적용 (0.5d)
- [X] Firestore Rules 적용 (07 문서 초안 기반)
- [X] Storage Rules 적용(로그인 사용자만 + owner/member만 업로드)
- [ ] pending/guest가 reviews/visits를 못 읽는지 테스트
- [ ] member가 타인 리뷰 수정 못 하는지 테스트

---

## E. 지도 메인 + 바텀시트 (2d)
- [x] 네이버 지도 SDK 로드 + 지도 렌더링(`/`)
- [x] 검색 UI(키워드 검색 → 후보 리스트) - UI만 구현, API 연동은 추후
- [x] place 마커 렌더링(초기엔 "최근 N개" 또는 "검색 결과 기반")
- [x] 마커 클릭 → 바텀시트(간략 정보 + stats 요약)
- [x] 바텀시트 클릭 → `/places/[placeId]` 이동

---

## F. 장소 상세 페이지(B 정책) (2d)
- [x] `/places/[placeId]` place 기본 정보 표시
- [ ] stats 문서 읽어서 통계 표시(guest/pending도 가능)
- [x] member/owner일 때만:
  - [ ] 리뷰 리스트 표시
  - [ ] 방문 기록 표시
  - [ ] 사진 갤러리 표시
- [x] pending/guest일 때:
  - [x] 리뷰/방문/사진 UI는 "잠금 상태"로 표시(안내 문구)
- [ ] 카카오 지도 버튼 연동 (장소 상세 페이지)

---

## G. 장소 추가(네이버 placeId 기반) (1.5d)
- [x] `/add` 구현: 네이버 검색 → place 선택
- [x] placeId 기준 중복 체크
  - [x] 없으면 `places/{placeId}` create(source=user_added)
  - [x] 있으면 상세로 이동
- [x] place 생성 시 최소 필드 검증
- [x] 홈 화면에 장소 추가 FAB 버튼 (member/owner만)

---

## H. 리뷰/방문 작성/편집 (2~3d)
- [ ] 리뷰 작성 컴포넌트( tier + tags + oneLineReview )
- [ ] 방문 기록 작성(visitedAt, companions, revisitIntent, 사진 업로드)
- [ ] 본인만 수정/삭제 가능(룰 + UI)
- [ ] 사진 업로드(Storage) + 메타데이터 저장
- [ ] stats 집계 업데이트(트랜잭션 or 함수)
  - [ ] reviewCount / tierCounts / topTags
  - [ ] visitCount

---

## I. 요청 시스템(수정/삭제 요청) (1.5d)
- [ ] member가 place 수정 요청 생성(`/requests`)
- [ ] member가 place 삭제 요청 생성
- [ ] 요청 상태(open/approved/rejected) 조회 UI(간단)

---

## J. Admin Console (owner only) (3~4d)
- [x] `/admin` dashboard (기본 구조)
- [x] `/admin/users`: pending → member 승인
- [ ] `/admin/requests`: 요청 승인/거절 (diff view)
- [x] `/admin/import`: JSON import(dry-run → commit)
  - [x] 네이버 북마크 JSON 파싱
  - [x] Preview 화면 (OK/DUPLICATE/INVALID 분류)
  - [x] Commit API Route (batch 처리)
  - [x] admin_logs 기록
- [ ] `/admin/places`: hide/unhide
- [ ] `/admin/settings`: rating label mapping 편집

---

## K. 마감 품질(1d)
- [ ] 에러/로딩 상태 정리
- [ ] 모바일 레이아웃 점검
- [ ] 라이트 모드(pending/guest) UX 문구 정리
- [ ] 기본 접근성(a11y) 점검(버튼 라벨, focus)
- [ ] 테스트 계정 시나리오:
  - [ ] guest → pending → member → owner 흐름 검증
  - [ ] 권한 우회 시도 테스트(직접 URL 접근, 콘솔 write)

---

## L. 외부 평점 데이터 크롤링 (MVP 이후)
- [ ] 네이버 지도 평점/리뷰 개수 크롤링
- [ ] 카카오 지도 평점/리뷰 개수 크롤링
- [ ] 구글 지도 평점/리뷰 개수 크롤링
- [ ] 크롤링 스케줄러 (주기적 실행)
- [ ] places 문서에 외부 평점 데이터 저장
- [ ] 장소 상세 페이지에 외부 평점 표시

---

## MVP Done Definition
- 로그인/닉네임 설정 가능
- 지도에서 장소 탐색 + 상세 접근 가능
- member는 장소/리뷰/방문/사진 추가 가능
- pending/guest는 통계만 보고 민감 데이터 접근 불가
- 요청/승인/Import 등 관리자 운영 가능
