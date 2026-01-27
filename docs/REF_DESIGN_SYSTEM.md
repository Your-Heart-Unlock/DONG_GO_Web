# Design System & UI Guidelines

## 목표
깔끔하면서도 맛집 서비스다운 감성을 전달하는 디자인 시스템

---

## 🎨 색상 시스템

### Primary Colors (Tier 기반)
평가 등급에 따른 시각적 차별화

```css
/* S Tier - 전파각 (최고) */
--tier-s-primary: #9333EA;    /* Purple 600 - 고급스러움 */
--tier-s-light: #F3E8FF;      /* Purple 100 */
--tier-s-dark: #6B21A8;       /* Purple 800 */

/* A Tier - 동네강자 (우수) */
--tier-a-primary: #2563EB;    /* Blue 600 - 신뢰감 */
--tier-a-light: #DBEAFE;      /* Blue 100 */
--tier-a-dark: #1E40AF;       /* Blue 800 */

/* B Tier - 평타 (보통) */
--tier-b-primary: #16A34A;    /* Green 600 - 안정감 */
--tier-b-light: #DCFCE7;      /* Green 100 */
--tier-b-dark: #15803D;       /* Green 800 */

/* C Tier - 땜빵 (아쉬움) */
--tier-c-primary: #EA580C;    /* Orange 600 - 주의 */
--tier-c-light: #FFEDD5;      /* Orange 100 */
--tier-c-dark: #C2410C;       /* Orange 800 */

/* F Tier - 지뢰 (비추) */
--tier-f-primary: #DC2626;    /* Red 600 - 경고 */
--tier-f-light: #FEE2E2;      /* Red 100 */
--tier-f-dark: #991B1B;       /* Red 800 */
```

### Neutral Colors
```css
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-200: #E5E7EB;
--gray-600: #4B5563;
--gray-900: #111827;
```

### Accent Colors
```css
--accent-yellow: #FCD34D;     /* 즐겨찾기, 하이라이트 */
--accent-blue: #3B82F6;       /* 링크, 액션 버튼 */
```

---

## 🗺️ 지도 마커 디자인

### 현재 문제점
- ❌ 기본 마커 사용 (빨간 핀)
- ❌ 장소 간 차별화 없음
- ❌ 평가 등급이 시각적으로 드러나지 않음

### 개선 방안

#### 옵션 A: Tier별 색상 마커 (추천 ⭐)
**장점**: 한눈에 등급 파악, 지도에서 색상 대비 명확

**구현**:
```typescript
// components/map/TierMarker.tsx
const MARKER_COLORS = {
  S: '#9333EA',  // Purple
  A: '#2563EB',  // Blue
  B: '#16A34A',  // Green
  C: '#EA580C',  // Orange
  F: '#DC2626',  // Red
  DEFAULT: '#6B7280', // Gray (평가 없음)
};

function createTierMarker(tier: RatingTier, name: string) {
  return `
    <svg width="32" height="40" viewBox="0 0 32 40">
      <!-- 마커 핀 모양 -->
      <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 24 16 24s16-12 16-24c0-8.837-7.163-16-16-16z" 
            fill="${MARKER_COLORS[tier]}" 
            stroke="white" 
            stroke-width="2"/>
      
      <!-- Tier 텍스트 -->
      <text x="16" y="18" 
            text-anchor="middle" 
            font-size="12" 
            font-weight="bold" 
            fill="white">
        ${tier}
      </text>
      
      <!-- 그림자 -->
      <ellipse cx="16" cy="38" rx="6" ry="2" fill="black" opacity="0.3"/>
    </svg>
  `;
}
```

**네이버 지도 적용**:
```typescript
const marker = new naver.maps.Marker({
  position: new naver.maps.LatLng(lat, lng),
  map: map,
  icon: {
    content: createTierMarker(topTier, place.name),
    anchor: new naver.maps.Point(16, 40), // 핀 끝이 좌표에 정확히
  },
  title: place.name,
});
```

#### 옵션 B: 카테고리 + Tier 조합 아이콘
**장점**: 카페/음식점 등 카테고리도 구분
**단점**: 아이콘 제작 필요, 복잡할 수 있음

```typescript
// 카테고리별 이모지 + Tier 배지
const CATEGORY_EMOJI = {
  '음식점': '🍽️',
  '카페': '☕',
  '술집': '🍺',
  '베이커리': '🥐',
};

// 마커: 이모지 + 하단 tier 배지
```

#### 옵션 C: 클러스터 마커 (여러 장소 묶을 때)
```typescript
function createClusterMarker(count: number, avgTier: RatingTier) {
  return `
    <div style="
      width: 40px;
      height: 40px;
      background: ${MARKER_COLORS[avgTier]};
      border-radius: 50%;
      border: 3px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      font-weight: bold;
      color: white;
      font-size: 14px;
    ">
      ${count}
    </div>
  `;
}
```

---

## 📱 컴포넌트 스타일

### 바텀시트
```css
.bottom-sheet {
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  background: white;
}

.bottom-sheet-handle {
  width: 40px;
  height: 4px;
  background: #D1D5DB;
  border-radius: 2px;
  margin: 12px auto;
}
```

### Tier 배지
```tsx
// components/ui/TierBadge.tsx
const TIER_STYLES = {
  S: 'bg-purple-100 text-purple-800 border-purple-300',
  A: 'bg-blue-100 text-blue-800 border-blue-300',
  B: 'bg-green-100 text-green-800 border-green-300',
  C: 'bg-orange-100 text-orange-800 border-orange-300',
  F: 'bg-red-100 text-red-800 border-red-300',
};

<span className={`
  inline-flex items-center gap-1 
  px-3 py-1 rounded-full 
  text-sm font-semibold 
  border-2
  ${TIER_STYLES[tier]}
`}>
  {tier} {TIER_LABELS[tier]}
</span>
```

### 카드 스타일
```css
.card {
  background: white;
  border-radius: 12px;
  border: 1px solid #E5E7EB;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 16px;
  transition: all 0.2s;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}
```

---

## 🔤 타이포그래피

### 폰트 스택
```css
font-family: 
  -apple-system, 
  BlinkMacSystemFont, 
  "Apple SD Gothic Neo",
  "Pretendard", 
  "Malgun Gothic", 
  sans-serif;
```

### 크기 및 용도
```css
/* 헤딩 */
.text-3xl { font-size: 1.875rem; }  /* 페이지 타이틀 */
.text-2xl { font-size: 1.5rem; }    /* 섹션 타이틀 */
.text-xl { font-size: 1.25rem; }    /* 카드 타이틀 */

/* 본문 */
.text-base { font-size: 1rem; }     /* 기본 텍스트 */
.text-sm { font-size: 0.875rem; }   /* 부가 정보 */
.text-xs { font-size: 0.75rem; }    /* 메타 정보 */
```

---

## 🎭 인터랙션

### 버튼
```css
/* Primary - 주요 액션 */
.btn-primary {
  background: #3B82F6;
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.2s;
}
.btn-primary:hover {
  background: #2563EB;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* FAB - 플로팅 액션 버튼 */
.fab {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #3B82F6;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  transition: all 0.3s;
}
.fab:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}
```

### 로딩 상태
```tsx
// Skeleton UI
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>

// Spinner
<svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
  <circle className="opacity-25" cx="12" cy="12" r="10" 
          stroke="currentColor" strokeWidth="4" fill="none"/>
  <path className="opacity-75" fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
</svg>
```

---

## 📐 레이아웃

### 반응형 브레이크포인트
```css
/* Tailwind 기준 */
sm: 640px   /* 모바일 가로/소형 태블릿 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 데스크탑 */
```

### 컨테이너
```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
}

/* 상세 페이지 (좁은 레이아웃) */
.content-narrow {
  max-width: 768px;
  margin: 0 auto;
}
```

---

## 🌓 다크모드 (선택사항)

MVP에서는 라이트 모드만 제공하되, 확장 가능하도록 설계

```css
/* 색상 변수로 정의 */
:root {
  --bg-primary: #FFFFFF;
  --text-primary: #111827;
  --border-color: #E5E7EB;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #1F2937;
    --text-primary: #F9FAFB;
    --border-color: #374151;
  }
}
```

---

## 🎨 아이콘 시스템

### 추천 라이브러리
- **Heroicons** (Tailwind 제작사) - 무료, MIT 라이선스
- **Lucide** - React 최적화, 가벼움

### 주요 아이콘
```typescript
// 공통 아이콘
<MapPinIcon />      // 장소 마커
<MagnifyingGlassIcon />  // 검색
<StarIcon />        // 즐겨찾기
<PlusCircleIcon />  // 추가
<PhotoIcon />       // 사진
<UserGroupIcon />   // 사용자
```

---

## 🚀 구현 우선순위

### Phase 1 - 지금 (MVP)
1. ✅ **Tier별 색상 마커** - 가장 임팩트 큼
2. ✅ **Tier 배지 스타일** - 일관성 있는 표시
3. ✅ **카드/버튼 기본 스타일** - 깔끔한 UI

### Phase 2 - 다음 (개선)
4. [ ] 마커 클러스터링 스타일
5. [ ] 로딩/에러 상태 디자인 통일
6. [ ] 애니메이션 효과 (부드러운 전환)

### Phase 3 - 나중 (고급)
7. [ ] 다크모드
8. [ ] 카테고리별 아이콘 마커
9. [ ] 커스텀 일러스트레이션

---

## 📝 디자인 시스템 적용 예시

### 장소 카드
```tsx
<div className="card">
  <div className="flex items-start justify-between">
    <div className="flex-1">
      <h3 className="text-xl font-bold text-gray-900">{place.name}</h3>
      <p className="text-sm text-gray-600 mt-1">{place.category}</p>
    </div>
    <TierBadge tier="S" />
  </div>
  
  <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
    <MapPinIcon className="w-4 h-4" />
    <span>{place.address}</span>
  </div>
  
  <div className="mt-4 flex gap-2">
    <span className="tier-tag tier-s">전파각</span>
    <span className="tier-tag tier-s">맛집</span>
  </div>
</div>
```

---

## 🎯 핵심 원칙

1. **일관성**: 모든 tier는 정해진 색상만 사용
2. **명확성**: 색상만으로도 등급을 직관적으로 파악
3. **접근성**: 색맹 사용자도 텍스트로 확인 가능
4. **반응성**: 모바일에서도 터치하기 쉬운 크기
5. **성능**: 마커가 많아도 부드러운 렌더링

---

## 참고 자료
- [Tailwind Colors](https://tailwindcss.com/docs/customizing-colors)
- [Heroicons](https://heroicons.com/)
- [네이버 지도 API - 마커 커스터마이징](https://navermaps.github.io/maps.js.ncp/docs/tutorial-8-marker-custom-icon.example.html)
