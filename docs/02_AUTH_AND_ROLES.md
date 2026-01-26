# Authentication & Roles

## 로그인
- Firebase Auth
- Google Sign-In 사용

## 닉네임 정책
- 최초 로그인 후 닉네임 설정 필수
- 닉네임 없으면 서비스 진입 불가
- 실명/이메일/프로필 사진은 노출 금지
- 모든 사용자 식별은 닉네임 기반

## Role 정의
- owner: 관리자 (1명)
- member: 승인된 사용자
- pending: 가입 대기 사용자
- guest: 비로그인 사용자

## 접근 정책 요약

| 기능 | guest | pending | member | owner |
|----|------|---------|--------|-------|
| 지도/검색 | O | O | O | O |
| 간략 정보 | O | O | O | O |
| 상세 페이지 | O (제한) | O (제한) | O | O |
| 리뷰/사진 보기 | X | X | O | O |
| 가게 추가 | X | X | O | O |
| 리뷰 작성 | X | X | O | O |
| 관리자 화면 | X | X | X | O |

## 익명성
- member 간에는 닉네임만 노출
- pending/guest에게는 작성자 정보 완전 익명
