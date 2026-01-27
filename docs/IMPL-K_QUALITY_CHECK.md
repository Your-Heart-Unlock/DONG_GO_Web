# K. 마감 품질 체크

## 목표
MVP 출시 전 최종 품질 검증

## 체크리스트

### 1. 에러/로딩 상태 정리
- [ ] 모든 API 호출에 try-catch
- [ ] 로딩 스피너/스켈레톤 UI
- [ ] 에러 토스트/알림
- [ ] 404/500 에러 페이지

**점검 파일들**:
- `app/places/[placeId]/page.tsx`
- `app/add/page.tsx`
- `components/reviews/ReviewList.tsx`
- `components/map/NaverMapView.tsx`

### 2. 모바일 레이아웃 점검
- [ ] 반응형 디자인 (Tailwind breakpoints)
- [ ] 터치 타겟 크기 (최소 44x44px)
- [ ] 바텀시트 모바일 동작
- [ ] 검색 input 포커스 시 키보드 대응

**테스트**:
- Chrome DevTools 모바일 시뮬레이터
- 실제 모바일 기기 (iOS, Android)

### 3. 라이트 모드 UX 문구 정리
**pending/guest 사용자 대상**

**현재 문구**:
- "🔒 멤버 전용 콘텐츠"
- "승인 대기 중입니다."

**개선 필요**:
- 일관된 톤앤매너
- 명확한 다음 액션 제시
- 긍정적인 표현

**예시**:
```tsx
{user?.role === 'pending' ? (
  <div className="bg-yellow-50 p-4 rounded-lg">
    <p className="font-semibold">승인 대기 중</p>
    <p className="text-sm mt-1">
      관리자 승인 후 모든 리뷰와 사진을 확인할 수 있습니다.
    </p>
  </div>
) : (
  <div className="bg-blue-50 p-4 rounded-lg">
    <p className="font-semibold">로그인하고 더 많은 정보를 확인하세요</p>
    <Link href="/login" className="text-blue-600 underline">
      Google 계정으로 로그인
    </Link>
  </div>
)}
```

### 4. 기본 접근성 (a11y)
- [ ] 모든 버튼에 `aria-label` 또는 텍스트
- [ ] 이미지에 `alt` 속성
- [ ] 폼 label과 input 연결
- [ ] 키보드 네비게이션 (Tab, Enter)
- [ ] 포커스 표시 (`focus:ring` 등)

**도구**:
- Lighthouse 접근성 점수 80+ 목표
- axe DevTools 확장 프로그램

### 5. 테스트 계정 시나리오

#### 시나리오 A: guest → pending → member
1. 비로그인 상태로 `/` 접속
2. 로그인 유도 확인
3. Google 로그인
4. 닉네임 온보딩 (`/onboarding/nickname`)
5. 홈 화면에서 pending 표시 확인
6. 장소 상세에서 "승인 대기" 메시지 확인
7. 관리자 계정으로 `/admin/users`에서 승인
8. member로 전환 후 리뷰 작성 가능 확인

#### 시나리오 B: 권한 우회 시도
1. pending 계정으로:
   - `/add` 직접 접근 시도 → 차단 확인
   - 콘솔에서 `reviews` 컬렉션 write 시도 → Firestore Rules 차단 확인
2. member 계정으로:
   - 타인 리뷰 수정 시도 → UI 버튼 없음 확인
   - 콘솔에서 타인 리뷰 수정 → Rules 차단 확인
3. `/admin` 직접 접근 (member로) → 403 또는 리다이렉트

#### 시나리오 C: 정상 플로우
1. member 계정으로 장소 추가
2. 리뷰 작성 (tier, tags, oneLineReview)
3. stats 업데이트 확인
4. 지도에서 마커 표시 확인
5. 바텀시트 → 상세 페이지 이동
6. 본인 리뷰 수정/삭제

### 6. 성능 점검
- [ ] Lighthouse Performance 점수 70+
- [ ] 큰 이미지 최적화 (Next.js Image 컴포넌트)
- [ ] 불필요한 리렌더 방지 (React.memo, useMemo)
- [ ] Firebase 읽기 횟수 모니터링

### 7. 배포 전 체크
- [ ] 환경변수 Vercel에 모두 설정
- [ ] Firebase Rules 배포 확인
- [ ] CORS 설정 (API routes)
- [ ] 도메인 연결 (선택)

## 참고 문서
- [REF_USER_EXPERIENCE.md](REF_USER_EXPERIENCE.md)
- [IMPL-D_SECURITY_RULES.md](IMPL-D_SECURITY_RULES.md)
