'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import {
  MonthlyLeaderboard,
  LeaderboardEntry,
  CategoryWinner,
  CategoryKey,
} from '@/types';
import {
  getPreviousMonthKey,
  getNextMonthKey,
  formatMonthKey,
} from '@/lib/utils/monthKey';
import { CATEGORY_LABELS } from '@/lib/utils/categoryIcon';

type TabType = 'overall' | 'review' | 'record';

const TABS: { key: TabType; label: string }[] = [
  { key: 'overall', label: '종합' },
  { key: 'review', label: '리뷰왕' },
  { key: 'record', label: '기록왕' },
];

const PODIUM_COLORS = [
  'bg-yellow-400', // 1st - Gold
  'bg-gray-300',   // 2nd - Silver
  'bg-amber-600',  // 3rd - Bronze
];

const PODIUM_TEXT = [
  'text-yellow-900',
  'text-gray-700',
  'text-amber-900',
];

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [monthKey, setMonthKey] = useState(getPreviousMonthKey());
  const [leaderboard, setLeaderboard] = useState<MonthlyLeaderboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overall');

  const isMemberOrOwner = user?.role === 'member' || user?.role === 'owner';

  useEffect(() => {
    async function fetchLeaderboard() {
      if (!db || !isMemberOrOwner) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
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
        } else {
          setLeaderboard(null);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
        setLeaderboard(null);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [monthKey, isMemberOrOwner]);

  const goToPreviousMonth = () => {
    setMonthKey(getPreviousMonthKey(monthKey));
  };

  const goToNextMonth = () => {
    const next = getNextMonthKey(monthKey);
    const latestAvailable = getPreviousMonthKey(); // 이전 월까지만 조회 가능
    if (next <= latestAvailable) {
      setMonthKey(next);
    }
  };

  const isLatestMonth = monthKey === getPreviousMonthKey();

  // 현재 탭에 맞는 리더보드 데이터
  const getCurrentEntries = (): LeaderboardEntry[] => {
    if (!leaderboard) return [];
    switch (activeTab) {
      case 'review':
        return leaderboard.reviewKingTop;
      case 'record':
        return leaderboard.recordKingTop;
      default:
        return leaderboard.overallTop;
    }
  };

  const entries = getCurrentEntries();
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3, 10);

  // 권한 없음
  if (!authLoading && !isMemberOrOwner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">멤버 전용 콘텐츠</h2>
          <p className="text-gray-600 mb-4">명예의 전당은 승인된 멤버만 볼 수 있습니다.</p>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">명예의 전당</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* 월 선택 */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-semibold text-gray-900 min-w-[120px] text-center">
            {formatMonthKey(monthKey)}
          </span>
          <button
            onClick={goToNextMonth}
            disabled={isLatestMonth}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <p>로딩 중...</p>
          </div>
        ) : !leaderboard ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-600">{formatMonthKey(monthKey)} 데이터가 없습니다.</p>
            <p className="text-sm text-gray-400 mt-1">다른 월을 선택해보세요.</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-end justify-center gap-4">
                  {/* 2nd place */}
                  {top3[1] && (
                    <div className="flex flex-col items-center">
                      <div className={`w-16 h-16 ${PODIUM_COLORS[1]} rounded-full flex items-center justify-center mb-2`}>
                        <span className={`text-2xl font-bold ${PODIUM_TEXT[1]}`}>2</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 text-center truncate max-w-[80px]">
                        {top3[1].nickname}
                      </p>
                      <p className="text-xs text-gray-500">{top3[1].value}</p>
                    </div>
                  )}
                  {/* 1st place */}
                  {top3[0] && (
                    <div className="flex flex-col items-center -mt-4">
                      <svg className="w-8 h-8 text-yellow-400 mb-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                      <div className={`w-20 h-20 ${PODIUM_COLORS[0]} rounded-full flex items-center justify-center mb-2 ring-4 ring-yellow-200`}>
                        <span className={`text-3xl font-bold ${PODIUM_TEXT[0]}`}>1</span>
                      </div>
                      <p className="text-base font-semibold text-gray-900 text-center truncate max-w-[100px]">
                        {top3[0].nickname}
                      </p>
                      <p className="text-sm text-gray-600">{top3[0].value}</p>
                    </div>
                  )}
                  {/* 3rd place */}
                  {top3[2] && (
                    <div className="flex flex-col items-center">
                      <div className={`w-16 h-16 ${PODIUM_COLORS[2]} rounded-full flex items-center justify-center mb-2`}>
                        <span className={`text-2xl font-bold ${PODIUM_TEXT[2]}`}>3</span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 text-center truncate max-w-[80px]">
                        {top3[2].nickname}
                      </p>
                      <p className="text-xs text-gray-500">{top3[2].value}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4th ~ 10th */}
            {rest.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {rest.map((entry, index) => (
                    <div key={entry.uid} className="flex items-center px-4 py-3">
                      <span className="w-8 text-sm font-medium text-gray-500">
                        #{index + 4}
                      </span>
                      <span className="flex-1 text-sm font-medium text-gray-900">
                        {entry.nickname}
                      </span>
                      <span className="text-sm text-gray-600">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 카테고리 챔피언 */}
            {Object.keys(leaderboard.categoryWinners).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">카테고리 챔피언</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(leaderboard.categoryWinners).map(([category, winner]) => (
                    <div
                      key={category}
                      className="bg-gray-50 rounded-lg p-3 text-center"
                    >
                      <p className="text-xs text-gray-500 mb-1">
                        {CATEGORY_LABELS[category as CategoryKey] || category}
                      </p>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {(winner as CategoryWinner).nickname}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(winner as CategoryWinner).reviews}개 리뷰
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* 서비스 통계 바로가기 */}
        <Link
          href="/stats"
          className="block bg-blue-50 rounded-xl border border-blue-200 p-4 hover:bg-blue-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-900">서비스 통계 보기</p>
              <p className="text-xs text-blue-600 mt-0.5">전체 리뷰, 장소, 등급 분포 확인</p>
            </div>
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </main>
    </div>
  );
}
