'use client';

import { useState, useEffect } from 'react';
import { SearchQuery, FilterState, RatingTier } from '@/types';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filterState: FilterState;
  onFilterChange: (state: FilterState) => void;
}

// 카테고리 목록 (실제 데이터에 맞게 조정 필요)
const CATEGORIES = [
  '한식',
  '일식',
  '중식',
  '양식',
  '카페',
  '디저트',
  '술집',
  '기타',
];

// 지역 목록
const REGIONS = [
  '강남',
  '홍대',
  '성수',
  '신촌',
  '이태원',
  '명동',
  '잠실',
  '여의도',
];

export default function FilterPanel({
  isOpen,
  onClose,
  filterState,
  onFilterChange,
}: FilterPanelProps) {
  const [query, setQuery] = useState<SearchQuery>({});
  // 필터 카운트 (추후 구현 시 사용)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [counts, setCounts] = useState<{ [key: string]: number; tiers?: { [key: string]: number } }>({});

  useEffect(() => {
    if (isOpen) {
      // 필터 패널이 열릴 때 현재 상태 로드
      setQuery({
        categories: filterState.categories,
        tiers: filterState.tiers,
        regions: filterState.regions,
        minReviews: filterState.minReviews,
        wishOnly: filterState.wishOnly,
        unvisitedOnly: filterState.unvisitedOnly,
        sortBy: filterState.sortBy,
        sortOrder: filterState.sortOrder,
      });
      // 카테고리별/등급별 개수 가져오기 (추후 구현)
      // fetchFilterCounts();
    }
  }, [isOpen, filterState]);

  const handleApply = () => {
    const activeCount = [
      query.categories?.length,
      query.tiers?.length,
      query.regions?.length,
      query.minReviews ? 1 : 0,
      query.wishOnly ? 1 : 0,
      query.unvisitedOnly ? 1 : 0,
    ].reduce((sum, count) => sum + (count || 0), 0);

    // 패널을 먼저 닫아서 빠르게 느껴지도록
    onClose();

    // 필터 적용 (API 호출은 백그라운드에서)
    onFilterChange({
      ...query,
      isActive: activeCount > 0,
      activeCount,
    });
  };

  const handleReset = () => {
    setQuery({});
    onFilterChange({
      isActive: false,
      activeCount: 0,
    });
    onClose(); // 초기화 후 필터 패널 닫기
  };

  return (
    <>
      {/* 배경 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* 슬라이드 패널 */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-bold">필터</h2>
            <button onClick={onClose} className="text-2xl hover:text-gray-600">
              ×
            </button>
          </div>

          {/* 필터 옵션들 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* 카테고리 */}
            <FilterGroup label="카테고리">
              {CATEGORIES.map(cat => (
                <Checkbox
                  key={cat}
                  label={`${cat}${counts[cat] ? ` (${counts[cat]})` : ''}`}
                  checked={query.categories?.includes(cat) || false}
                  onChange={(checked) => {
                    const categories = checked
                      ? [...(query.categories || []), cat]
                      : query.categories?.filter(c => c !== cat);
                    setQuery({ ...query, categories });
                  }}
                />
              ))}
            </FilterGroup>

            {/* 등급 */}
            <FilterGroup label="등급">
              <div className="flex gap-2 flex-wrap">
                {(['S', 'A', 'B', 'C', 'F'] as RatingTier[]).map(tier => (
                  <TierChip
                    key={tier}
                    tier={tier}
                    selected={query.tiers?.includes(tier) || false}
                    count={counts.tiers?.[tier] || 0}
                    onClick={() => {
                      const tiers = query.tiers?.includes(tier)
                        ? query.tiers.filter(t => t !== tier)
                        : [...(query.tiers || []), tier];
                      setQuery({ ...query, tiers });
                    }}
                  />
                ))}
              </div>
            </FilterGroup>

            {/* 지역 */}
            <FilterGroup label="지역">
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={query.regions?.[0] || ''}
                onChange={(e) => {
                  const regions = e.target.value ? [e.target.value] : undefined;
                  setQuery({ ...query, regions });
                }}
              >
                <option value="">전체</option>
                {REGIONS.map(region => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </FilterGroup>

            {/* 기타 옵션 */}
            <FilterGroup label="기타">
              <Switch
                label="내가 안 가본 곳만"
                checked={query.unvisitedOnly || false}
                onChange={(checked) =>
                  setQuery({ ...query, unvisitedOnly: checked })
                }
              />
              <Switch
                label="가고 싶어요 한 곳만"
                checked={query.wishOnly || false}
                onChange={(checked) =>
                  setQuery({ ...query, wishOnly: checked })
                }
              />
            </FilterGroup>

            {/* 정렬 */}
            <FilterGroup label="정렬">
              <select
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={query.sortBy || 'recent'}
                onChange={(e) => {
                  const value = e.target.value as 'recent' | 'rating' | 'reviews' | 'wishes';
                  setQuery({ ...query, sortBy: value });
                }}
              >
                <option value="recent">최신순</option>
                <option value="rating">평점순</option>
                <option value="reviews">리뷰 많은 순</option>
                <option value="wishes">가고 싶어요 많은 순</option>
              </select>
            </FilterGroup>
          </div>

          {/* 하단 버튼 */}
          <div className="p-4 border-t flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              초기화
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
            >
              적용
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ========== 하위 컴포넌트들 ==========

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold mb-2 text-gray-700">{label}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <span className="text-sm">{label}</span>
      <div
        className={`relative w-12 h-6 rounded-full transition-colors ${
          checked ? 'bg-blue-500' : 'bg-gray-300'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </div>
    </label>
  );
}

function TierChip({
  tier,
  selected,
  count,
  onClick,
}: {
  tier: RatingTier;
  selected: boolean;
  count: number;
  onClick: () => void;
}) {
  const tierStyles = {
    S: {
      bg: selected ? 'bg-purple-500' : 'bg-purple-100',
      text: selected ? 'text-white' : 'text-purple-700',
      hover: selected ? 'hover:bg-purple-600' : 'hover:bg-purple-200',
    },
    A: {
      bg: selected ? 'bg-blue-500' : 'bg-blue-100',
      text: selected ? 'text-white' : 'text-blue-700',
      hover: selected ? 'hover:bg-blue-600' : 'hover:bg-blue-200',
    },
    B: {
      bg: selected ? 'bg-green-500' : 'bg-green-100',
      text: selected ? 'text-white' : 'text-green-700',
      hover: selected ? 'hover:bg-green-600' : 'hover:bg-green-200',
    },
    C: {
      bg: selected ? 'bg-orange-500' : 'bg-orange-100',
      text: selected ? 'text-white' : 'text-orange-700',
      hover: selected ? 'hover:bg-orange-600' : 'hover:bg-orange-200',
    },
    F: {
      bg: selected ? 'bg-red-500' : 'bg-red-100',
      text: selected ? 'text-white' : 'text-red-700',
      hover: selected ? 'hover:bg-red-600' : 'hover:bg-red-200',
    },
  };

  const style = tierStyles[tier];

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm font-semibold transition-colors ${style.bg} ${style.text} ${style.hover}`}
    >
      {tier} {count > 0 && `(${count})`}
    </button>
  );
}
