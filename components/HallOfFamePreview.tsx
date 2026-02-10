'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import { getPreviousMonthKey, formatMonthKey } from '@/lib/utils/monthKey';
import { MonthlyLeaderboard } from '@/types';

interface HallOfFamePreviewProps {
  expandDirection?: 'down' | 'up';
}

export default function HallOfFamePreview({ expandDirection = 'down' }: HallOfFamePreviewProps) {
  const [leaderboard, setLeaderboard] = useState<MonthlyLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchLeaderboard() {
      if (!db) {
        setLoading(false);
        return;
      }

      try {
        const monthKey = getPreviousMonthKey();
        const leaderboardRef = doc(db, 'monthly_leaderboard', monthKey);
        const snapshot = await getDoc(leaderboardRef);

        if (snapshot.exists()) {
          const data = snapshot.data();
          setLeaderboard({
            month: data.month,
            generatedAt: data.generatedAt?.toDate() || new Date(),
            reviewKingTop: data.reviewKingTop || [],
            recordKingTop: data.recordKingTop || [],
            overallTop: data.overallTop || [],
            categoryWinners: data.categoryWinners || {},
            hiddenCount: data.hiddenCount || 0,
          });
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard preview:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  const monthKey = getPreviousMonthKey();
  const top3 = leaderboard?.overallTop?.slice(0, 3) || [];
  const hasData = top3.length > 0;

  // 로딩 중이거나 데이터 없으면 간단한 버튼만 표시
  if (loading) {
    return (
      <Link
        href="/leaderboard"
        className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-900 px-3 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all"
      >
        <span className="text-lg">🏆</span>
        <span className="text-sm font-bold">명예의 전당</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      {/* 축소된 상태 - 클릭하면 확장 */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-amber-900 pl-3 pr-4 py-2.5 rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition-all border border-yellow-300"
        >
          <span className="text-xl">🏆</span>
          <div className="text-left">
            <p className="text-xs font-medium opacity-80">{formatMonthKey(monthKey)}</p>
            <p className="text-sm font-bold">명예의 전당</p>
          </div>
          {hasData && top3[0] && (
            <div className="ml-2 pl-2 border-l border-amber-600/30">
              <p className="text-xs opacity-70">1위</p>
              <p className="text-sm font-bold truncate max-w-[60px]">{top3[0].nickname}</p>
            </div>
          )}
        </button>
      ) : (
        /* 확장된 상태 - 미니 리더보드 */
        <div className={`bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 rounded-2xl shadow-xl border-2 border-yellow-300 overflow-hidden w-72 animate-in fade-in zoom-in-95 duration-200 ${expandDirection === 'up' ? 'absolute bottom-full right-0 mb-2' : ''}`}>
          {/* 헤더 */}
          <div className="bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🏆</span>
              <div>
                <p className="text-amber-900 text-xs font-medium opacity-80">{formatMonthKey(monthKey)}</p>
                <p className="text-amber-900 font-bold">명예의 전당</p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 hover:bg-amber-500/30 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-amber-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 콘텐츠 */}
          <div className="p-4">
            {!hasData ? (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">지난 달 데이터가 없어요</p>
                <p className="text-gray-400 text-xs mt-1">이번 달 리뷰를 작성해보세요!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Top 3 */}
                {top3.map((entry, index) => (
                  <div
                    key={entry.uid}
                    className={`flex items-center gap-3 p-2 rounded-lg ${
                      index === 0
                        ? 'bg-yellow-200/60 ring-2 ring-yellow-400'
                        : index === 1
                        ? 'bg-gray-200/60'
                        : 'bg-amber-200/40'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-yellow-400 text-yellow-900'
                          : index === 1
                          ? 'bg-gray-300 text-gray-700'
                          : 'bg-amber-500 text-amber-900'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm">
                        {entry.nickname}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{entry.value}점</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 상세보기 버튼 */}
            <Link
              href="/leaderboard"
              className="mt-4 block w-full text-center bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-semibold py-2.5 rounded-xl hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md hover:shadow-lg"
            >
              전체 순위 보기 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
