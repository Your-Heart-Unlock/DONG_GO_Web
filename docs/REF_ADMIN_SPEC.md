# Admin Console Spec (MVP)

> 이 문서는 관리자(owner)가 사용하는 **운영 전용 화면**에 대한 스펙이다.  
> 역할/권한/데이터 모델의 정의는 아래 문서를 참조한다.
>
> - AUTH & ROLE: `02_AUTH_AND_ROLES.md`
> - DATA MODEL: `03_DATA_MODEL.md`
> - RATING SYSTEM: `04_RATING_SYSTEM.md`

---

## 1. 목적
관리자(owner)가 다음 작업을 **안전하고 빠르게 수행**할 수 있도록 한다.

- 초기 데이터 마이그레이션 (네이버 지도 → Firestore)
- 사용자 승인(pending → member)
- 가게 수정/삭제 요청 처리
- 운영 상태 모니터링
- 실수 방지 및 로그 추적

---

## 2. 접근 제어
- `/admin` 이하 모든 페이지는 `role == owner`만 접근 가능
- 비-owner 접근 시:
  - 403 페이지 또는 홈으로 redirect

---

## 3. 관리자 화면 구조

/admin
├─ dashboard (요약)
├─ requests (요청 처리)
├─ import (데이터 마이그레이션)
├─ users (유저 관리)
├─ places (장소 관리)
└─ settings (라벨/설정)

---

## 4. Dashboard (/admin)
### 목적
현재 서비스 상태와 처리해야 할 작업을 한눈에 파악.

### 구성
- KPI 요약
  - 전체 장소 수
  - 전체 리뷰 수
  - open 요청 수
  - pending 사용자 수
- 최근 요청 리스트 (최대 20개)
- 최근 Import 실행 결과 요약

---

## 5. Requests (/admin/requests)
### 목적
멤버가 생성한 **수정/삭제 요청을 검토하고 승인/거절**한다.

### 대상 요청
- place_edit
- place_delete

### 리스트
- 요청 타입
- 장소 이름
- 요청자 닉네임
- 생성일
- 상태(open / approved / rejected)

### 요청 상세
- 요청 메타 정보
- 변경 전/후 비교(diff view)
- 요청 사유
- 승인 / 거절 버튼 (confirm 필수)

### 승인 시 공통 처리
- place 데이터 반영
- request 상태 업데이트
- admin_logs 기록

> 삭제 요청은 MVP에서 **Hard delete 금지**  
> → `status = hidden` 처리 권장

---

## 6. Import (/admin/import)
### 목적
외부 JSON(특히 **네이버 지도 북마크 export JSON**)을 Firestore `places`로 안전하게 등록한다.
초기 마이그레이션 및 이후 추가 입력을 모두 지원한다.

---

### 지원 입력 포맷 (중요)
관리자 Import는 아래 **2가지 포맷**을 지원한다.

#### (A) Naver Bookmark Export JSON (권장)
형태(요약):
```json
{
  "folder": { "...": "..." },
  "bookmarkList": [
    {
      "sid": "네이버 place id",
      "name": "가게명",
      "address": "주소",
      "px": 127.0,
      "py": 37.0,
      "mcid": "DINING",
      "mcidName": "음식점"
    }
  ]
}
```

##### 매핑 규칙:
- placeId = bookmark.sid (필수, docId로 사용 권장)
- name = bookmark.name
- address = bookmark.address
- lat = bookmark.py
- lng = bookmark.px
- category = bookmark.mcidName (UI 표시용)
- (옵션) categoryCode = bookmark.mcid (필터/분석용)
- (옵션) sourceMeta에 원본 일부를 저장할 수 있음 (memo/url/folderId 등)
> 좌표 해석: px = lng, py = lat

#### (B) Plain ImportRow Array (내부/확장용)

형태:
```json
[
  { "placeId": "123", "name": "...", "address": "...", "lat": 37.0, "lng": 127.0, "category": "..." }
]
```

---

### 흐름
1. JSON 업로드 또는 붙여넣기
2. 포맷 판별
- 최상위에 bookmarkList(배열)가 있으면 (A)로 처리
- 입력이 배열이면 (B)로 처리
- 그 외는 INVALID(에러)
3. 파싱 및 검증 (Dry-run)
- 각 row에 대해 상태 분류:
  - OK: 유효 + 신규 placeId
  - DUPLICATE: 유효 + 이미 존재하는 placeId
  - INVALID: 필수 필드 누락/형식 오류/좌표 범위 오류 등
- Firestore 존재 여부 조회로 중복 판단(placeId 기준)
4. 미리보기 화면 제공
- 요약: total / ok / duplicate / invalid
- 테이블: row별 상태 + 실패 사유 표시
5. Commit 실행 (Confirm 필수)
- 설정한 중복 정책 적용 후 실제 DB 반영
- 결과 리포트 출력 + admin_logs 기록

---

### 필수 정책
- 고유 ID(placeId) 필수
  - (A)에서는 sid가 placeId 역할
- 중복(placeId 이미 존재) 처리 정책:
  - 기본: SKIP (기존 유지)
  - 옵션: UPDATE (name/address/lat/lng/category 갱신)
- Import는 항상 Dry-run → Commit 2단계
- 대량 입력은 Firestore batch 제한을 고려해 chunk로 커밋(<= 500 ops/batch)

---

### 저장 규칙 (places 문서)
- 문서 경로: places/{placeId} (placeId = sid 권장)
- 생성 시 기본 필드:
  - source = "naver_import"
  - createdBy = ownerUid
  - status = "active"
  - createdAt/updatedAt 기록
- UPDATE 정책일 때는 updatedAt만 갱신

---

### 결과 (Commit 이후)
- 성공/스킵/실패 개수 리포트
- 실패 원인(예: missing sid, invalid lat/lng, parse error 등) 목록
- Import 실행 로그 기록:
  - admin_logs.action = "IMPORT_PLACES"
  - metadata: total/created/updated/skipped/invalid + duplicatePolicy

---

## 7. Users (/admin/users)
### 목적
가입 사용자 승인 및 역할 관리.

### 기능
- 사용자 리스트 (nickname / role / createdAt)
- pending → member 승인
- member 강등 또는 차단 (선택, confirm 필수)

> 사용자 role 정의는 `02_AUTH_AND_ROLES.md` 참조

---

## 8. Places (/admin/places)
### 목적
장소 상태를 관리하고 문제 장소를 제어.

### 기능
- 검색 (이름 / 주소 / placeId)
- source / status 필터
- Hide / Unhide 토글

> 장소 데이터 구조는 `03_DATA_MODEL.md` 참조

---

## 9. Settings (/admin/settings)
### 목적
운영 중 변경 가능한 설정 관리.

### MVP 범위
- 평가 라벨 표시 문구 매핑
  - S/A/B/C/F → labelShort / labelLong

> ratingTier 정의는 `04_RATING_SYSTEM.md` 참조

---

## 10. 운영 안전장치 (필수)
- 모든 관리자 액션은 admin_logs 기록
- 파괴적 액션은 confirm modal 필수
- Import는 항상 Dry-run → Commit
- 삭제는 숨김 처리 우선



