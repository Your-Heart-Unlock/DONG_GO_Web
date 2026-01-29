'use client';

import { useState, useEffect, useRef } from 'react';
import { FilterState } from '@/types';
import FilterPanel from './FilterPanel';

export interface SearchResultItem {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  categoryKey?: string;
}

interface SearchBarProps {
  placeholder?: string;
  onFilterChange?: (filterState: FilterState) => void;
  // 검색 드롭다운
  searchResults?: SearchResultItem[];
  searchLoading?: boolean;
  searchTotal?: number;
  onResultClick?: (result: SearchResultItem) => void;
  onAddSearchClick?: (query: string) => void;
  onQueryChange?: (query: string) => void;
}

export default function SearchBar({
  placeholder = '장소 검색...',
  onFilterChange,
  searchResults,
  searchLoading,
  searchTotal,
  onResultClick,
  onAddSearchClick,
  onQueryChange,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    isActive: false,
    activeCount: 0,
  });

  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // input 변경 시 디바운스 검색
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length >= 1) {
      debounceRef.current = setTimeout(() => {
        onQueryChange?.(value.trim());
      }, 300);
    } else {
      setShowDropdown(false);
    }
  };

  // 클리어 버튼
  const handleClear = () => {
    setQuery('');
    setShowDropdown(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  // 결과 클릭
  const handleResultClick = (result: SearchResultItem) => {
    setQuery(result.name);
    setShowDropdown(false);
    onResultClick?.(result);
  };

  // 결과 변경 시 드롭다운 표시
  useEffect(() => {
    if (searchLoading || (searchResults && query.trim().length > 0)) {
      setShowDropdown(true);
    }
  }, [searchResults, searchLoading, query]);

  // 필터 패널 열릴 때 드롭다운 닫기
  useEffect(() => {
    if (showFilters) setShowDropdown(false);
  }, [showFilters]);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleFilterChange = (newFilterState: FilterState) => {
    setFilterState(newFilterState);
    onFilterChange?.(newFilterState);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 1) {
      onQueryChange?.(query.trim());
    }
  };

  return (
    <>
      <div className="relative" ref={wrapperRef}>
        <form onSubmit={handleSubmit} className="w-full flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => {
                if (searchResults && searchResults.length > 0 && query.trim()) {
                  setShowDropdown(true);
                }
              }}
              placeholder={placeholder}
              className="w-full py-3 pl-10 pr-4 text-sm bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* 필터 버튼 */}
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            className="px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span className="text-sm font-medium text-gray-700">필터</span>
            {filterState.activeCount > 0 && (
              <span className="bg-blue-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-semibold">
                {filterState.activeCount}
              </span>
            )}
          </button>
        </form>

        {/* 검색 결과 드롭다운 */}
        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto z-50">
            {searchLoading && (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                검색 중...
              </div>
            )}

            {!searchLoading && searchResults && searchResults.length > 0 && (
              <>
                {searchResults.map((result) => (
                  <button
                    key={result.placeId}
                    type="button"
                    onClick={() => handleResultClick(result)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {result.name}
                      </span>
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        {result.category}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {result.address}
                    </div>
                  </button>
                ))}
                {searchTotal !== undefined && searchTotal > searchResults.length && (
                  <div className="px-4 py-2 text-xs text-gray-400 text-center border-t border-gray-100">
                    {searchTotal}건 중 {searchResults.length}건 표시
                  </div>
                )}
              </>
            )}

            {!searchLoading && searchResults && searchResults.length === 0 && query.trim() && (
              <div className="px-4 py-5 text-center">
                <p className="text-sm text-gray-500 mb-3">검색 결과가 없습니다</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    onAddSearchClick?.(query.trim());
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  식당 추가 검색하기
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 필터 패널 */}
      <FilterPanel
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filterState={filterState}
        onFilterChange={handleFilterChange}
      />
    </>
  );
}
