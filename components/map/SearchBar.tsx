'use client';

import { useState } from 'react';
import { FilterState } from '@/types';
import FilterPanel from './FilterPanel';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  onFilterChange?: (filterState: FilterState) => void;
}

export default function SearchBar({
  onSearch,
  placeholder = '장소 검색...',
  onFilterChange,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterState, setFilterState] = useState<FilterState>({
    isActive: false,
    activeCount: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && onSearch) {
      onSearch(query.trim());
    }
  };

  const handleFilterChange = (newFilterState: FilterState) => {
    setFilterState(newFilterState);
    if (onFilterChange) {
      onFilterChange(newFilterState);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
              onClick={() => setQuery('')}
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
