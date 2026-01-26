목적

외부 지도 서비스(네이버/카카오/구글 등)의 “평점/리뷰 수”를 주기적으로 수집하여
Firestore places 문서의 externalRatings 필드를 갱신하고, 상세 페이지에 표시한다.

본 문서는 크롤링(자동 수집) 기반 구현 설계를 다룬다.

매우 중요한 운영 원칙 (필수)

대상 사이트/서비스의 ToS 및 robots.txt가 허용하는 범위에서만 자동 수집을 수행한다.

허용이 불명확하거나 금지된 경우(예: 전면 Disallow)에는 해당 소스 크롤링을 기능적으로 OFF한다.

가능한 경우 크롤링 대신 공식 API를 우선 사용한다.

서비스는 “외부 평점” 없이도 정상 동작해야 한다(옵션 기능).

수집 대상 데이터

rating: 평균 평점 (예: 4.3)

reviewCount: 리뷰 개수 (예: 1200)

updatedAt: 마지막 수집 시각

sourceMeta(선택): 출처 URL, 수집 방식, 오류 코드 등

데이터 모델 (Firestore)

places 문서에 다음 구조를 저장한다.

places/{placeId}.externalRatings

naver: { rating, reviewCount, updatedAt, status, sourceUrl }

kakao: { rating, reviewCount, updatedAt, status, sourceUrl }

google: { rating, reviewCount, updatedAt, status, sourceUrl }

status 예시:

ok: 최신 수집 성공

disabled: 정책/robots/승인 문제로 비활성화

error: 일시 오류(네트워크/파싱 실패 등)

stale: 오래된 데이터(예: 30일 이상 갱신 없음)

place 매칭 전략 (필수)

외부 소스별로 안정적인 매칭 키를 places에 저장한다.

places/{placeId}.externalIds

naverPlaceId: string (예: "76394657")

kakaoPlaceId: string

googlePlaceId: string

원칙:

“이름+주소 검색으로 매번 매칭”은 오차/중복 리스크가 커서 지양한다.

최초 1회는 수동으로 externalIds를 채우고, 이후는 해당 ID로만 업데이트한다.

실행 환경 (간헐/주기 실행)

크롤러는 웹 서비스(Next.js)와 분리된 “배치 작업”으로 운영한다.

선택지:
A) 수동 실행(로컬)

개발/테스트용, 필요할 때만 실행

B) GitHub Actions (추천)

간헐/주기 실행 모두 가능

저장소에 워크플로우로 등록

C) Google Cloud Scheduler + Cloud Run/Functions

운영 정석, 로그/재시도/권한 관리 편함

원칙:

크롤링이 실패해도 서비스는 정상이어야 한다.

크롤러는 Firestore에만 쓰고, 프론트는 그 값을 읽어 표시한다.

구현 구성요소

Crawler Runner

Node.js 스크립트 또는 컨테이너 엔트리포인트

Firestore에서 “업데이트 대상 place 목록”을 가져옴

Source Fetcher (source별 모듈)

googleFetcher / naverFetcher / kakaoFetcher

입력: externalPlaceId

출력: { rating, reviewCount } 또는 { status: disabled/error, reason }

Parser (필요 시)

HTML 기반이면 파싱 로직 포함(단, 금지/우회 목적 구현 금지)

Writer

결과를 places.externalRatings에 upsert

성공/실패/disabled 상태 기록

Logging

admin_logs 또는 crawl_logs 컬렉션에 실행 결과 기록

업데이트 전략 (스케줄링/빈도)

목표는 “실시간”이 아니라 “참고용 최신화”다.

권장 빈도:

7일 ~ 30일 주기(초기엔 14일 추천)

장소 수가 많아지면 “회차별 분할 업데이트” (예: 1회 실행에 200개만)

우선순위:

최근에 리뷰가 많이 달린/자주 조회되는 장소를 먼저 업데이트 (선택)

레이트 리밋/안전장치 (필수)

요청 간 지연(예: 0.5~2초 랜덤 지터)

동시성 제한(예: 3~5개 이하)

실패 시 재시도는 제한(예: 2회)

연속 실패 시 해당 source는 잠시 차단(backoff)

실패/정책 이슈 처리

크롤링이 불가능하거나 금지된 경우:

externalRatings.{source}.status = "disabled"

reason에 “robots/ToS disallow” 등 사유 기록

UI에서는 “데이터 제공 불가”로 표시하거나 숨김

파싱 실패/일시 장애:

status = "error"

마지막 성공값은 유지하되 updatedAt은 갱신하지 않음

UI에서는 “기준일 오래됨” 표시(예: stale)

운영 플로우 (권장)

externalIds를 관리자 화면에서 세팅(또는 import 시 포함)

크롤러를 간헐/주기 실행

결과를 Firestore에 기록

상세 페이지에서 externalRatings 표시

disabled/error/stale 상태를 UI에서 명확히 표현

MVP 이후 체크리스트 (크롤링 버전)

 externalIds 필드 추가 및 입력 UI(관리자)

 crawler runner(로컬 실행) 1차 구현

 Google(가능하면 API)부터 연동

 결과를 places.externalRatings에 저장

 UI에 출처/기준일 포함 표시

 GitHub Actions 또는 Cloud Scheduler로 주기 실행

 실패/차단 상태 기록 및 표시

주의

네이버/카카오 등 정책/robots가 금지하는 대상은 기본적으로 OFF로 두고,
명시적 허용/공식 수단 확보 시에만 활성화한다.

본 프로젝트는 “외부 평점이 없어도” 핵심 기능이 성립해야 한다.