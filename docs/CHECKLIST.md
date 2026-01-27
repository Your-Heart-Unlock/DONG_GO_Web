# MVP Implementation Checklist

## 🎯 현재 작업 우선순위 (주차별 계획)

**업데이트: 2026-01-27**

### P0 - MVP 완성 (즉시, 1일)
> **목표**: 보안 확정 + 기본 버그 수정

1. [ ] **보안 규칙 테스트** (D섹션) - 0.5d
   - pending/guest가 reviews 못 읽는지 검증
   - member가 타인 리뷰 수정 못 하는지 검증
   - 직접 URL 접근 및 콘솔 write 시도 테스트

2. [ ] **지도 링크 동적 처리** (F섹션) - 0.5d
   - 네이버 ID면 네이버 지도, 카카오 ID면 카카오 지도
   - places 문서에 mapProvider 필드 추가 또는 placeId 패턴으로 판단

**완료 시**: MVP 100% → 실제 사용 가능 🎉

---

### P1 - 기본 UX 개선 (1주차, 5.5일)
> **목표**: 비용 절감 + 사용성 개선

3. [ ] **지도 성능 최적화** (E섹션) - 2d ⭐ 최우선
   - 줌 게이트 + bounds 기반 로딩 (읽기 비용 절감)
   - geohash/cellId 인덱스 활용
   - 마커 클러스터링

4. [ ] **스마트 필터** (N섹션) - 2d
   - 카테고리/등급/지역 필터링
   - 미방문/위시리스트 필터
   - 지도 마커 연동

5. [ ] **좌표 기반 중복 체크** (G섹션) - 1d
   - geohash 필드 추가 (Import 시 자동 생성)
   - 100m 이내 중복 장소 감지

6. [ ] **사진 업로드 시스템** (H섹션) - 0.5d
   - Firebase Storage 연동
   - 이미지 업로드/표시/삭제

**완료 시**: 비용 절감 + 빠른 지도 + 필터로 빠르게 찾기 💰⚡

---

### P2 - 핵심 신기능 (2주차, 3.5일)
> **목표**: 위시리스트 + 통계로 몰입도 증가

7. [ ] **위시리스트** (O섹션) - 1.5d
   - "가고 싶어요" 버튼
   - 내 위시리스트 페이지
   - 친구들이 가고 싶어하는 곳 표시

8. [ ] **개인 통계 대시보드** (P섹션) - 2d
   - `/me/stats` 페이지
   - 리뷰/등급 분포 차트
   - 카테고리별 분석

**완료 시**: 가고 싶은 곳 관리 + 내 취향 분석 → 계속 쓰고 싶은 서비스 💚

---

### P3 - 재미 요소 (3주차, 4일)
> **목표**: "우리끼리 셀럽" - 경쟁과 성취감

9. [ ] **리더보드** (Q섹션) - 2d
   - 점수 계산 시스템
   - 랭킹 UI (👑🥈🥉)
   - "우리끼리 셀럽" 만들기

10. [ ] **뱃지 시스템** (R섹션) - 1d
    - 기본 뱃지 10개
    - 자동 뱃지 부여
    - 프로필에 뱃지 표시

11. [ ] **전체 통계 페이지** (S섹션) - 1d
    - `/stats` 서비스 통계
    - 인기 장소 TOP 10
    - 카테고리/등급 분포

**완료 시**: 재미있는 서비스 → 친구들과 경쟁하며 더 많이 리뷰 🏆

---

### P4 - 완성도 높이기 (4주차, 1일)
> **목표**: 품질 개선

12. [ ] **품질 체크** (K섹션) - 1d
    - 에러/로딩 상태 정리
    - 모바일 레이아웃 점검
    - 접근성 개선

**완료 시**: 안정적이고 완성도 높은 서비스 ✨

---

### P5 - 운영 기능 (나중에, 3.5일)
> **목표**: 관리자 편의 기능

13. [ ] **요청 시스템** (I섹션) - 1.5d
    - member의 수정/삭제 요청
    - owner의 승인/거절

14. [ ] **Admin 장소 관리** (J섹션) - 1d
    - `/admin/places`: hide/unhide
    - `/admin/settings`: rating label 편집

15. [ ] **알림 시스템** (U섹션) - 1d
    - 새 리뷰/장소 알림
    - 순위 변동 알림

**완료 시**: 관리 편한 서비스 🛠️

---

### P6 - 선택 기능 (여유 있을 때)
> **목표**: 있으면 좋지만 필수는 아닌 것들

16. [ ] **초대 시스템** (T섹션) - 1.5d (지금은 수동으로 충분)
17. [ ] **PWA** (V섹션) - 1d (앱처럼 사용)
18. [ ] **토큰 시스템** (M섹션) - 2d (게이미피케이션 추가)
19. [ ] **외부 평점 크롤링** (L섹션) - 2d (네이버/카카오 평점)

**완료 시**: 풀옵션 서비스 🚀

---

## 📅 추천 진행 순서

**Week 0 (지금)**: P0 완료 → MVP 배포  
**Week 1**: P1 완료 → 사용성 대폭 개선  
**Week 2**: P2 완료 → 위시리스트 + 통계  
**Week 3**: P3 완료 → 리더보드 + 뱃지로 재미  
**Week 4**: P4 완료 → 최적화 + 품질
🔥 비용 절감 (지도 최적화) + UX 개선  
**Week 2**: P2 완료 → 위시리스트 + 통계  
**Week 3**: P3 완료 → 리더보드 + 뱃지로 재미  
**Week 4**: P4 완료 → 품질 체크

→ **1개월 후**: 완성도 높은 v1.0 완성! 🎊

**그 이후**: P5, P6는 사용자 피드백 보고 결정

**⚠️ 중요**: P1의 지도 최적화를 먼저 해야 Firestore 읽기 비용 폭탄을 피할 수 있습니다!

목표: “작동하는 서비스”를 가장 빠르게 만들고, 이후 확장 가능하게 유지.

---

## A. 프로젝트 부트스트랩 (0.5~1d) → 상세: `IMPL-A_BOOTSTRAP.md`
- [x] Next.js(Typescript) 프로젝트 생성
- [x] ESLint/Prettier 세팅
- [x] 환경변수 구조 확정 (Firebase config, Naver Map key)
- [x] Vercel 배포 파이프라인 연결

---

## B. Firebase 기본 세팅 (0.5d) → 상세: `IMPL-B_FIREBASE_SETUP.md`
- [X] Firebase 프로젝트 생성 (사용자가 Firebase Console에서 수동 생성 필요)
- [X] Firestore/Storage/Auth 활성화 (사용자가 Firebase Console에서 수동 활성화 필요)
- [X] Auth: Google Sign-In 설정 (사용자가 Firebase Console에서 수동 설정 필요)
- [x] Firebase SDK 코드 준비 (client.ts, admin.ts, auth.ts, user.ts)
- [X] Firestore 컬렉션 초기 설계 반영 (02_DATA_MODEL.md 기준) - Rules 배포 시
- [ ] `config/ratings` 문서 생성(라벨 매핑 초기값) - Admin Import 구현 시

---

## C. 인증 + 온보딩(닉네임 게이트) (1d) → 상세: `IMPL-C_AUTH_ONBOARDING.md`
- [x] `/login` 페이지: Google 로그인
- [x] 로그인 후 `users/{uid}` 없으면 생성(role=pending)
- [x] `/onboarding/nickname` 구현
  - [x] 닉네임 입력/검증(길이/금칙어)
  - [x] 닉네임 저장 후 홈 이동
- [x] 공통 훅: `useAuth`, `useUserRole` (AuthContext.tsx)
- [x] pending/guest/member 상태를 클라이언트에서 인지 가능하게
- [x] NicknameGate 가드 구현 (전역 레이아웃 적용)

---

## D. 권한/보안 규칙 적용 (0.5d) → 상세: `IMPL-D_SECURITY_RULES.md`
- [x] Firestore Rules 적용 (IMPL-D_SECURITY_RULES.md 기반, Firebase Console에 배포됨)
- [x] Storage Rules 적용(로그인 사용자만 + owner/member만 업로드)
- [ ] pending/guest가 reviews/visits를 못 읽는지 테스트
- [ ] member가 타인 리뷰 수정 못 하는지 테스트

---

## E. 지도 메인 + 바텀시트 (2~3d) → 상세: `IMPL-E_MAP_BOTTOMSHEET.md`
- [x] 네이버 지도 SDK 로드 + 지도 렌더링(`/`)
- [x] 검색 UI(키워드 검색 → 후보 리스트) - **UI만, API 미연동**
- [x] place 마커 렌더링(최근 100개)
- [x] 마커 클릭 → 바텀시트(간략 정보 + stats 요약)
- [x] 바텀시트 클릭 → `/places/[placeId]` 이동
- [x] 홈 화면에 장소 추가 FAB 버튼 (member/owner만)
- [ ] **줌 게이트 + bounds 기반 로딩** (줌 낮을 때 마커 로딩 안함, 높을 때만 현재 화면 로딩)
- [ ] **places에 geohash/cellId 필드 추가** (범위 쿼리용 인덱스)
- [ ] **마커 클러스터링** (렌더링 성능 향상)
- [ ] **검색/필터 기능** (카테고리, 지역별 필터링)

---

## F. 장소 상세 페이지(B 정책) (2d) → 상세: `IMPL-F_PLACE_DETAIL.md`
- [x] `/places/[placeId]` place 기본 정보 표시
- [x] stats 문서 읽어서 통계 표시(guest/pending도 가능)
- [x] member/owner일 때만:
  - [x] 리뷰 리스트 표시 (ReviewList 컴포넌트)
  - [ ] 방문 기록 표시 - **미구현**
  - [ ] 사진 갤러리 표시 - **UI만, 업로드 미구현**
- [x] pending/guest일 때:
  - [x] 리뷰/방문/사진 UI는 "잠금 상태"로 표시(안내 문구)
- [ ] **지도 링크 동적 처리** (네이버 ID면 네이버, 카카오 ID면 카카오 지도)

---

## G. 장소 추가(네이버 placeId 기반) (1.5d) → 상세: `IMPL-G_ADD_PLACE.md`
- [x] `/add` 구현: 카카오 검색 → place 선택
- [x] placeId 기준 중복 체크 + naver-resolve로 네이버 ID 매칭
  - [x] 없으면 `places/{placeId}` create(source=user_added)
  - [x] 있으면 상세로 이동
- [x] place 생성 시 최소 필드 검증
- [x] 검색 페이지네이션 (10개씩)
- [ ] **좌표 기반 중복 체크** (ID 다르지만 같은 위치 ~100m 이내 감지)

---

## H. 리뷰/방문 작성/편집 (2~3d) → 상세: `IMPL-H_REVIEW_VISIT.md`
- [x] 리뷰 작성 컴포넌트( tier + tags + oneLineReview )
- [x] 리뷰 수정/삭제 (본인만, UI로 제어)
- [x] 방문 정보 (visitedAt, companions, revisitIntent) 리뷰에 통합
- [ ] 방문 기록 별도 컬렉션 (선택사항, 필요 시)
- [ ] 사진 업로드(Storage) - **미구현**
- [x] stats 집계 업데이트 (recalculateStats 함수)
  - [x] reviewCount / tierCounts / topTags

---

## I. 요청 시스템(수정/삭제 요청) (1.5d) → 상세: `IMPL-I_REQUEST_SYSTEM.md` - **전체 미구현**
- [ ] member가 place 수정 요청 생성(`/requests`)
- [ ] member가 place 삭제 요청 생성
- [ ] 요청 상태(open/approved/rejected) 조회 UI(간단)

---

## J. Admin Console (owner only) (3~4d) → 상세: `IMPL-J_ADMIN_CONSOLE.md`
- [x] `/admin` dashboard (기본 구조)
- [x] `/admin/users`: pending → member 승인 (완전 구현)
- [ ] `/admin/requests`: 요청 승인/거절 - **페이지 없음**
- [x] `/admin/import`: JSON import(dry-run → commit)
  - [x] 네이버 북마크 JSON 파싱
  - [x] Preview 화면 (OK/DUPLICATE/INVALID 분류)
  - [x] Commit API Route (batch 처리)
  - [x] admin_logs 기록
- [ ] `/admin/places`: hide/unhide - **빈 페이지**
- [ ] `/admin/settings`: rating label mapping 편집 - **페이지 없음**

---

## K. 마감 품질(1d) → 상세: `IMPL-K_QUALITY_CHECK.md`
- [ ] 에러/로딩 상태 정리
- [ ] 모바일 레이아웃 점검
- [ ] 라이트 모드(pending/guest) UX 문구 정리
- [ ] 기본 접근성(a11y) 점검(버튼 라벨, focus)
- [ ] 테스트 계정 시나리오:
  - [ ] guest → pending → member → owner 흐름 검증
  - [ ] 권한 우회 시도 테스트(직접 URL 접근, 콘솔 write)

---

## L. 외부 평점 데이터 크롤링 (MVP 이후) → 상세: `IMPL-L_CRAWLING.md`
- [ ] 네이버 지도 평점/리뷰 개수 크롤링
- [ ] 카카오 지도 평점/리뷰 개수 크롤링
- [N. 스마트 검색 & 필터 (2d) - **신규**
- [ ] SearchQuery 인터페이스 정의
  - [ ] keyword (이름/주소)
  - [ ] categories (다중 선택)
  - [ ] tiers (S/A/B/C/F)
  - [ ] regions (주소에서 추출)
  - [ ] minReviews
  - [ ] wishOnly / unvisitedOnly
  - [ ] sortBy (recent/rating/reviews/wishes)
- [ ] API Route 구현
  - [ ] `/api/search/places` - 복합 필터 쿼리
  - [ ] Firestore 복합 인덱스 생성
- [ ] UI 컴포넌트
  - [ ] FilterPanel.tsx (슬라이드 오버)
  - [ ] 카테고리 체크박스
  - [ ] 등급 Chip 선택
  - [ ] 지역 Select
  - [ ] 미방문/위시리스트 토글
  - [ ] 필터 적용/초기화 버튼
- [ ] 지도 연동
  - [ ] 필터 변경 시 마커 업데이트
  - [ ] URL 쿼리스트링에 필터 상태 저장
- [ ] 필터 카운트 표시 (각 옵션별 개수)

**상세**: `IMPL-N_SMART_FILTER.md`

---

## O. 위시리스트 시스템 (1.5d) - **신규**
- [ ] Firestore 컬렉션 설계
  - [ ] `wishes/{wishId}` 문서 생성
  - [ ] placeId, uid, createdAt, note 필드
- [ ] API Routes
  - [ ] POST `/api/wishes` - 위시 추가
  - [ ] DELETE `/api/wishes/{wishId}` - 위시 삭제
  - [ ] GET `/api/wishes?uid={uid}` - 내 위시리스트
  - [ ] GET `/api/wishes?placeId={placeId}` - 이 장소를 원하는 사람들
- [ ] UI 구현
  - [ ] PlaceBottomSheet에 "가고 싶어요" 버튼 (💚/🤍 토글)
  - [ ] 장소 상세에 "OO님, OO님이 가고 싶어해요" 표시
  - [ ] `/me/wishlist` 페이지 - 내 위시리스트 지도 뷰
  - [ ] 프로필에 "가고 싶어요 {count}개" 탭 추가
- [ ] 홈 화면 위젯
  - [ ] "친구들이 가장 가고 싶어하는 곳 TOP 5"
  - [ ] "우리 모두가 가고 싶어하는 곳" 필터 (3명 모두 wish)
- [ ] PlaceStats에 wishCount 필드 추가

**상세**: `IMPL-O_WISHLIST.md`

---

## P. 개인 통계 대시보드 (2d) - **신규**
- [ ] `/me/stats` 페이지 생성
- [ ] UserStats 인터페이스 정의
  - [ ] 기본 통계 (총 리뷰, 방문 장소, 평균 등급)
  - [ ] 등급 분포 (S/A/B/C/F 개수)
  - [ ] 카테고리 분석 (top 3 카테고리, 카테고리별 평균 등급)
  - [ ] 시간 분석 (월별 리뷰 수, 최다 활동 월)
  - [ ] 재방문 분석 (재방문 의도 비율)
  - [ ] 그룹 내 랭킹
- [ ] 통계 계산 함수
  - [ ] calculateUserStats(uid) - Firestore에서 집계
  - [ ] users 문서에 stats 필드 추가 (선택)
- [ ] 시각화 (Chart.js 또는 Recharts)
  - [ ] 요약 카드 (리뷰 개수, 방문 장소 등)
  - [ ] 도넛 차트 - 등급 분포
  - [ ] 바 차트 - 카테고리별 평균 등급
  - [ ] 라인 차트 - 월별 활동
  - [ ] 취향 프로필 텍스트 ("까다로운 미식가")
- [ ] 프로필에서 통계 페이지 링크

**상세**: `IMPL-P_USER_STATS.md`

---

## Q. 리더보드 (2d) - **신규**
- [ ] 점수 계산 시스템
  - [ ] 리뷰 1개 = 10점
  - [ ] 장소 추가 1개 = 20점
  - [ ] S등급 1개 = 5점 보너스
  - [ ] calculatePoints(user) 함수
- [ ] LeaderboardEntry 인터페이스
  - [ ] uid, nickname, profileImage
  - [ ] totalPoints, breakdown
  - [ ] totalReviews, totalSGrades
  - [ ] rank, rankChange (전주 대비)
- [ ] API Route
  - [ ] GET `/api/leaderboard` - 전체 순위
  - [ ] 주기적 업데이트 (매일 00시) 또는 실시간 계산
- [ ] `/leaderboard` 페이지
  - [ ] 1위: 👑 크라운 + 하이라이트
  - [ ] 2위: 🥈 실버
  - [ ] 3위: 🥉 브론즈
  - [ ] 4~10위: 일반 카드
  - [ ] 내 순위 고정 표시 (하단)
- [ ] 홈 화면 위젯
  - [ ] "이번 주 MVP"
  - [ ] "맛집 발굴왕"
  - [ ] "까다로운 심사위원" (S등급 많이 준 사람)
- [ ] users 문서에 points 필드 추가

**상세**: `IMPL-Q_LEADERBOARD.md`

---

## R. 뱃지 시스템 (1d) - **신규**
- [ ] Badge 인터페이스 정의
  - [ ] badgeId, name, description, icon, condition
- [ ] 기본 뱃지 6개
  - [ ] `first_review` - 첫 리뷰 (✍️)
  - [ ] `reviewer_10` - 리뷰어 10개 (📝)
  - [ ] `veteran_50` - 베테랑 50개 (🎖️)
  - [ ] `explorer` - 탐험가 (장소 5개 추가) (🗺️)
  - [ ] `perfectionist` - 완벽주의자 (S등급 10개) (⭐)
  - [ ] `foodie` - 미식가 (평균 등급 4.0 이상) (🍽️)
- [ ] 뱃지 자동 부여 로직
  - [ ] checkAndAwardBadges(uid) 함수
  - [ ] 리뷰/장소 추가 시 자동 체크
- [ ] users 문서에 badges 필드 추가 (배열)
- [ ] UI
  - [ ] 프로필 페이지에 뱃지 갤러리
  - [ ] 리뷰 작성자 이름 옆에 대표 뱃지 아이콘
  - [ ] 뱃지 획득 시 토스트 알림

**상세**: `IMPL-R_BADGES.md`

---

## S. 전체 통계 페이지 (1d) - **신규**
- [ ] ServiceStats 인터페이스
  - [ ] totalPlaces, totalReviews, totalUsers
  - [ ] 인기 장소 TOP 10
  - [ ] 카테고리별 분포
  - [ ] 등급별 분포
  - [ ] 최근 추가된 장소
  - [ ] 논란의 장소 (평가 편차 큰 곳)
  - [ ] 숨은 맛집 (리뷰 적지만 S등급)
- [ ] API Route
  - [ ] GET `/api/stats/service` - 전체 통계 집계
- [ ] `/stats` 페이지 (모든 member 접근 가능)
  - [ ] 요약 카드 ("우리가 지금까지 120곳을 발굴했습니다")
  - [ ] 카테고리 분포 도넛 차트
  - [ ] 등급 분포 바 차트
  - [ ] 인기 장소 리스트
  - [ ] "이번 달 가장 핫한 맛집"
  - [ ] "숨은 맛집" 섹션

**상세**: `IMPL-S_SERVICE_STATS.md`

---

## T. 초대 시스템 (1.5d) - **신규** (나중에)
- [ ] `invites` 컬렉션 설계
  - [ ] inviteCode (랜덤), createdBy, maxUses, usedCount, expiresAt, usedBy
- [ ] API Routes
  - [ ] POST `/api/admin/invites` - 초대 코드 생성 (owner만)
  - [ ] GET `/api/invites/{code}` - 초대 코드 검증
  - [ ] POST `/api/invites/{code}/use` - 초대 코드 사용
- [ ] 회원가입 플로우 수정
  - [ ] `/signup?invite=ABC123` 쿼리 파라미터 처리
  - [ ] 초대 코드 입력 UI
  - [ ] 유효한 코드면 자동 member 승급
- [ ] Admin 페이지
  - [ ] `/admin/invites` - 초대 코드 관리
  - [ ] 코드 생성/삭제
  - [ ] 사용 내역 조회

**상세**: `IMPL-T_INVITE_SYSTEM.md`

---

## U. 알림 시스템 (1d) - **신규** (나중에)
- [ ] `notifications` 컬렉션
  - [ ] notificationId, uid, type, message, link, read, createdAt
- [ ] 알림 타입
  - [ ] `new_place` - 새로운 장소 추가됨
  - [ ] `friend_review` - 친구가 리뷰 작성
  - [ ] `rank_change` - 순위 변동
- [ ] API Routes
  - [ ] GET `/api/notifications` - 내 알림 목록
  - [ ] PATCH `/api/notifications/{id}` - 읽음 처리
- [ ] UI
  - [ ] 헤더에 NotificationBell (미읽음 카운트)
  - [ ] 알림 드롭다운
  - [ ] 알림 클릭 시 해당 페이지로 이동

**상세**: `IMPL-U_NOTIFICATIONS.md`

---

## V. PWA (1d) - **신규** (나중에)
- [ ] `manifest.json` 생성
  - [ ] name, short_name, start_url, display, icons
- [ ] Service Worker 구현
  - [ ] 오프라인 캐싱
  - [ ] 백그라운드 동기화
- [ ] 홈 화면 추가 안내
- [ ] 오프라인 페이지

**상세**: `IMPL-V_PWA.md`

---

## MVP Done Definition
- 로그인/닉네임 설정 가능
- 지도에서 장소 탐색 + 상세 접근 가능
- member는 장소/리뷰/방문/사진 추가 가능
- pending/guest는 통계만 보고 민감 데이터 접근 불가
- 요청/승인/Import 등 관리자 운영 가능

## v1.0 Done Definition (MVP + 확장)
- MVP 완료 +
- 스마트 필터로 빠르게 찾기 가능
- 위시리스트로 가고 싶은 곳 관리
- 개인 통계로 내 맛집 취향 파악
- 리더보드로 "우리끼리 셀럽" 경쟁
- 뱃지로 재미 요소 추가
- 전체 통계로 서비스 현황 파악

## M. 토큰 시스템 (참여 유도, 선택) → 상세: `IMPL-M_USER_TOKENS.md`
- [ ] users 컬렉션에 `tokens` 필드 추가 (기본값: 5~10)
- [ ] 토큰 획득 로직 구현
  - [ ] 장소 등록 시 +1
  - [ ] 리뷰 작성 시 +1
  - [ ] 방문 기록 작성 시 +1
  - [ ] 사진 포함 시 +1
- [ ] 장소별 해금 상태 관리 (`users/{uid}/unlocked_places/{placeId}`)
- [ ] 장소 상세 페이지에 토큰 잠금 UI 추가
  - [ ] 해금 전: 통계만 표시, 상세 리뷰는 🔒
  - [ ] 토큰 소모(-1)로 해금 기능
  - [ ] 해금 후: 모든 리뷰 접근 가능
- [ ] 헤더에 현재 토큰 수 표시

---

## MVP Done Definition
- 로그인/닉네임 설정 가능
- 지도에서 장소 탐색 + 상세 접근 가능
- member는 장소/리뷰/방문/사진 추가 가능
- pending/guest는 통계만 보고 민감 데이터 접근 불가
- 요청/승인/Import 등 관리자 운영 가능
