# 📚 DONG_GO_Web 문서 구조

본 프로젝트의 문서는 에이전트가 효율적으로 작업할 수 있도록 체계적으로 구성되어 있습니다.

---

## 📋 메인 문서

### [CHECKLIST.md](CHECKLIST.md) ⭐ **시작점**
전체 MVP 구현 체크리스트. 각 섹션(A~M)마다 대응하는 `IMPL-X` 문서 참조 링크 포함.

### [PROGRESS.md](PROGRESS.md)
작업 중 발견한 이슈, 개선 아이디어, 임시 메모

---

## 🏗️ 기초 문서

| 파일 | 설명 |
|------|------|
| [00_OVERVIEW.md](00_OVERVIEW.md) | 프로젝트 개요, 목적, MVP 범위 |
| [01_TECH_STACK.md](01_TECH_STACK.md) | Next.js, Firebase, Naver Maps 등 기술 스택 |
| [02_DATA_MODEL.md](02_DATA_MODEL.md) | Firestore 컬렉션 스키마 정의 |
| [03_ROUTING.md](03_ROUTING.md) | App Router 구조 및 라우팅 전략 |

---

## 🔧 구현 가이드 (IMPL)

각 체크리스트 항목에 1:1 대응하는 상세 구현 문서. **에이전트가 작업 시 참조할 주요 문서**입니다.

| 파일 | 체크리스트 | 상태 | 설명 |
|------|------------|------|------|
| `IMPL-A_BOOTSTRAP.md` | A. 프로젝트 부트스트랩 | ✅ 완료 | Next.js 초기 설정, Vercel 배포 |
| [IMPL-B_FIREBASE_SETUP.md](IMPL-B_FIREBASE_SETUP.md) | B. Firebase 기본 세팅 | ✅ 완료 | Firebase 프로젝트, SDK 연동 |
| [IMPL-C_AUTH_ONBOARDING.md](IMPL-C_AUTH_ONBOARDING.md) | C. 인증 + 온보딩 | ✅ 완료 | Google 로그인, 닉네임 설정 |
| [IMPL-D_SECURITY_RULES.md](IMPL-D_SECURITY_RULES.md) | D. 보안 규칙 | ✅ 완료 | Firestore/Storage Rules |
| [IMPL-E_MAP_BOTTOMSHEET.md](IMPL-E_MAP_BOTTOMSHEET.md) | E. 지도 + 바텀시트 | ⚠️ 부분 | 줌 게이트, 클러스터링 미완 |
| [IMPL-F_PLACE_DETAIL.md](IMPL-F_PLACE_DETAIL.md) | F. 장소 상세 페이지 | ⚠️ 부분 | 방문 기록, 사진 미완 |
| [IMPL-G_ADD_PLACE.md](IMPL-G_ADD_PLACE.md) | G. 장소 추가 | ⚠️ 부분 | 좌표 기반 중복 체크 미완 |
| [IMPL-H_REVIEW_VISIT.md](IMPL-H_REVIEW_VISIT.md) | H. 리뷰/방문 | ⚠️ 부분 | 리뷰 완료, 방문/사진 미완 |
| [IMPL-I_REQUEST_SYSTEM.md](IMPL-I_REQUEST_SYSTEM.md) | I. 요청 시스템 | ❌ 미구현 | 수정/삭제 요청 전체 |
| [IMPL-J_ADMIN_CONSOLE.md](IMPL-J_ADMIN_CONSOLE.md) | J. Admin Console | ⚠️ 부분 | users/import 완료, requests/places/settings 미완 |
| [IMPL-K_QUALITY_CHECK.md](IMPL-K_QUALITY_CHECK.md) | K. 마감 품질 | ⏳ 진행 중 | 최종 QA 체크리스트 |
| [IMPL-L_CRAWLING.md](IMPL-L_CRAWLING.md) | L. 외부 평점 크롤링 | ❌ 미구현 | MVP 이후 작업 |
| [IMPL-M_USER_TOKENS.md](IMPL-M_USER_TOKENS.md) | M. 토큰 시스템 | ❌ 미구현 | 참여 유도 기능 (선택) |

---

## 📖 참고 문서 (REF)

구현 시 참조하는 상세 정책 및 전략 문서.

| 파일 | 설명 |
|------|------|
| `REF_AUTH_ROLES.md` | 역할 시스템 (owner/member/pending/guest) 상세 정책 |
| `REF_RATING_SYSTEM.md` | 평가 시스템 (S/A/B/C/F 등급) 설명 |
| `REF_USER_EXPERIENCE.md` | UX 정책 (A/B/C 정책, 라이트 모드 등) |
| `REF_ADMIN_SPEC.md` | 관리자 기능 상세 스펙 |
| `REF_MAP_STRATEGY.md` | 지도 마커 로딩, 클러스터링 전략 |

---

## 🤖 에이전트 작업 가이드

### 1. 새로운 기능 구현 시
1. [CHECKLIST.md](CHECKLIST.md)에서 해당 섹션 확인
2. `IMPL-X` 문서를 열어 상세 내용 파악
3. "미구현 항목" 섹션에서 작업 대상 확인
4. 관련 REF 문서 참조 (필요 시)
5. 구현 완료 후 CHECKLIST.md 체크박스 업데이트

### 2. 버그 수정 또는 개선 시
1. [PROGRESS.md](PROGRESS.md)에 이슈 기록 (또는 확인)
2. 관련 `IMPL-X` 문서의 "체크포인트" 확인
3. 수정 후 테스트 시나리오 실행

### 3. 문서 업데이트
- 구현 내용 변경 시 해당 `IMPL-X` 문서도 함께 업데이트
- 새로운 패턴 발견 시 REF 문서에 추가

---

## 📁 디렉토리 구조 요약

```
docs/
├── 📄 README.md (본 파일)
├── 📄 CHECKLIST.md (메인 체크리스트)
├── 📄 PROGRESS.md (작업 로그)
│
├── 🏗️ 기초 문서
│   ├── 00_OVERVIEW.md
│   ├── 01_TECH_STACK.md
│   ├── 02_DATA_MODEL.md
│   └── 03_ROUTING.md
│
├── 🔧 구현 가이드 (IMPL-X)
│   ├── IMPL-A_BOOTSTRAP.md
│   ├── IMPL-B_FIREBASE_SETUP.md
│   ├── IMPL-C_AUTH_ONBOARDING.md
│   ├── IMPL-D_SECURITY_RULES.md
│   ├── IMPL-E_MAP_BOTTOMSHEET.md
│   ├── IMPL-F_PLACE_DETAIL.md
│   ├── IMPL-G_ADD_PLACE.md
│   ├── IMPL-H_REVIEW_VISIT.md
│   ├── IMPL-I_REQUEST_SYSTEM.md
│   ├── IMPL-J_ADMIN_CONSOLE.md
│   ├── IMPL-K_QUALITY_CHECK.md
│   ├── IMPL-L_CRAWLING.md
│   └── IMPL-M_USER_TOKENS.md
│
└── 📖 참고 문서 (REF_X)
    ├── REF_AUTH_ROLES.md
    ├── REF_RATING_SYSTEM.md
    ├── REF_USER_EXPERIENCE.md
    ├── REF_ADMIN_SPEC.md
    └── REF_MAP_STRATEGY.md
```

---

## ✨ 문서 개편 이력
- **2026-01-27**: 기존 번호 체계에서 IMPL/REF 체계로 전환
- 목적: 에이전트가 체크리스트와 구현 가이드를 명확히 연결하여 효율적으로 작업할 수 있도록 개선
