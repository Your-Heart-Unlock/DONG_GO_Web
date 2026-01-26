# Firestore & Storage Security Rules (MVP)

본 문서는 `02_AUTH_AND_ROLES.md`의 역할 정책과 `03_DATA_MODEL.md`의 스키마를 기준으로,
실제 Firebase Security Rules 설계를 고정한다.

---

## 1) 핵심 원칙

### 역할 기반 접근
- `owner`: 모든 관리/승인/숨김 처리 가능
- `member`: place 생성 가능(중복 방지 placeId 유니크), visit/review는 본인 것만 작성/수정/삭제 가능
- `pending`: read-only 라이트 모드 (place 기본 + stats만), visit/review/사진 접근 불가
- `guest`: pending과 동일 (로그인 전)

### 민감 데이터 정의
- 민감 데이터: review 본문, 사진, 방문 맥락(visitedAt, companions, revisitIntent), 작성자 식별 정보(uid/nickname 포함)
- pending/guest는 민감 데이터 접근 불가

### “상세 페이지 B 정책” 구현 포인트
- pending/guest도 상세 URL은 열리게 할 수 있으나,
  **실제로는 Firestore Rules에서 민감 컬렉션을 막아** UI가 통계만 보여주도록 한다.

---

## 2) 권장 데이터 배치 (Rules 단순화를 위해 강력 권장)

MVP에서 권한을 깔끔하게 하려면 아래 구조가 유리하다.

- `places/{placeId}`: place 기본 정보 (pending/guest 읽기 허용)
- `places/{placeId}/stats/{doc}` 혹은 `places/{placeId}/stats`(문서): 통계 (pending/guest 읽기 허용)
- `reviews/{reviewId}`: 민감 데이터 (member 이상만 읽기)
- `visits/{visitId}`: 민감 데이터 (member 이상만 읽기)
- `requests/{requestId}`: 요청 (member create 가능, resolve는 owner만)
- `users/{uid}`: 닉네임/role (본인 read 가능 + owner는 관리용 read 가능)

> NOTE: pending/guest에게 작성자 닉네임도 숨기려면,
> reviews/visits는 아예 막고, stats만 보여주는 방식이 가장 안전하다.

---

## 3) Firestore Rules (초안)

아래는 “app router + 클라이언트 SDK” 기준으로 동작 가능한 형태의 규칙 골격이다.
실제 적용 전, 컬렉션/문서 경로를 코드와 반드시 일치시키기.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- Helpers ----------
    function signedIn() {
      return request.auth != null;
    }

    function userDoc() {
      return signedIn()
        ? get(/databases/$(database)/documents/users/$(request.auth.uid))
        : null;
    }

    function role() {
      return signedIn() ? userDoc().data.role : "guest";
    }

    function isOwner() {
      return role() == "owner";
    }

    function isMemberOrOwner() {
      return role() == "member" || role() == "owner";
    }

    function isPendingOrGuest() {
      return role() == "pending" || role() == "guest";
    }

    function isSelf(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    function isValidLatLng(lat, lng) {
      return lat is number && lng is number
        && lat >= -90 && lat <= 90
        && lng >= -180 && lng <= 180;
    }

    // ---------- users ----------
    match /users/{uid} {
      allow create: if signedIn() && isSelf(uid)
        && request.resource.data.nickname is string
        && request.resource.data.nickname.size() >= 2
        && request.resource.data.nickname.size() <= 20
        && request.resource.data.role in ["pending", "member", "owner"];

      // 본인만 read, owner는 운영상 전체 read 가능
      allow read: if isSelf(uid) || isOwner();

      // 본인은 nickname 등 일부만 업데이트 허용 (role은 owner만)
      allow update: if isSelf(uid)
        && !( "role" in request.resource.data.diff(resource.data).changedKeys() );
      allow update: if isOwner(); // owner는 role 변경 가능(운영)

      allow delete: if isOwner(); // MVP: 필요 시에만
    }

    // ---------- places (public-ish) ----------
    match /places/{placeId} {
      // read: 누구나 (guest/pending 포함) 가능
      allow read: if true;

      // create: member/owner만. placeId는 docId로 관리 권장(중복 방지)
      allow create: if isMemberOrOwner()
        && request.resource.data.placeId == placeId
        && request.resource.data.name is string
        && request.resource.data.address is string
        && isValidLatLng(request.resource.data.lat, request.resource.data.lng)
        && request.resource.data.source in ["naver_import", "user_added"]
        && request.resource.data.status in ["active", "hidden", "deleted"];

      // update/delete: owner만 (멤버는 요청(requests)로만)
      allow update, delete: if isOwner();
    }

    // ---------- place stats (readable for pending/guest) ----------
    // Option A: places/{placeId}/stats (document) 형태면 아래처럼
    match /places/{placeId}/stats/{docId} {
      allow read: if true;
      allow write: if isOwner(); // 또는 서버(Cloud Functions)만
    }

    // ---------- reviews (sensitive) ----------
    match /reviews/{reviewId} {
      // read: member/owner만
      allow read: if isMemberOrOwner();

      // create: member/owner만, 본인 uid만 허용
      allow create: if isMemberOrOwner()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.placeId is string
        && request.resource.data.ratingTier in ["S","A","B","C","F"];

      // update/delete: 작성자 본인만 (owner도 관리 필요하면 owner 허용)
      allow update, delete: if isMemberOrOwner()
        && resource.data.uid == request.auth.uid;

      // 운영 편의상 owner가 수정/삭제 가능하게 하려면:
      // allow update, delete: if isOwner() || (isMemberOrOwner() && resource.data.uid == request.auth.uid);
    }

    // ---------- visits (sensitive) ----------
    match /visits/{visitId} {
      allow read: if isMemberOrOwner();

      allow create: if isMemberOrOwner()
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.placeId is string;

      allow update, delete: if isMemberOrOwner()
        && resource.data.uid == request.auth.uid;
    }

    // ---------- requests ----------
    match /requests/{requestId} {
      // read:
      // - member/owner는 읽기 가능(본인 요청 확인)
      // - pending/guest는 기본적으로 불가
      allow read: if isMemberOrOwner();

      // create: member/owner
      allow create: if isMemberOrOwner()
        && request.resource.data.requestedBy == request.auth.uid
        && request.resource.data.type in ["place_edit", "place_delete"]
        && request.resource.data.status == "open";

      // update: owner만(approve/reject)
      allow update: if isOwner();

      allow delete: if isOwner(); // MVP: 필요 시에만
    }

    // ---------- admin logs ----------
    match /admin_logs/{logId} {
      allow read, write: if isOwner();
    }

    // ---------- config (rating label mapping etc.) ----------
    match /config/{docId} {
      allow read: if true;      // 라벨 매핑은 공개 가능(민감X)
      allow write: if isOwner();
    }
  }
}
```

---

## 4) Firebase Storage Rules (사진)

### 원칙:
- 업로드: member/owner만
- 다운로드(read): member/owner만
- pending/guest는 사진 접근 불가

### 권장 경로:
- photos/{uid}/{placeId}/{filename}

### Storage Rules 초안:

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function signedIn() { return request.auth != null; }

    // Firestore users 문서를 조회하는 rules는 storage에서 직접 get 불가
    // => Storage read/write를 "로그인 여부"로만 제한하고,
    // 민감도는 Firestore에서 메타데이터 접근을 차단하는 방식이 실무적으로 안전함.
    // (또는 커스텀 클레임으로 role을 토큰에 넣는 방식)

    match /photos/{uid}/{placeId}/{fileName} {
      allow read: if signedIn();   // 최소: 로그인 사용자만
      allow write: if signedIn() && request.auth.uid == uid;
    }
  }
}
```

역할(pending/member)을 Storage에서 엄격히 나누려면 커스텀 클레임을 쓰거나,
아예 Storage는 로그인 사용자만 read로 두고, UI에서 pending이면 사진 URL 자체를 받지 못하게(메타데이터 막기) 운영한다.

## 5) 필수 구현 체크

- 최초 로그인 후 users/{uid} 생성 + role 기본값 pending
- owner가 /admin/users에서 pending → member 승인
- pending/guest는 reviews/visits read 불가 → 상세 페이지에서도 통계만 보이게 됨
- stats 집계는 클라이언트에서 전체 리뷰를 읽어 계산하지 말고, places/{placeId}/stats에 저장된 집계 문서를 읽어 표시
