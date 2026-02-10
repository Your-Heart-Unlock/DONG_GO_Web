'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';

interface AdminStats {
  totalPlaces: number;
  totalReviews: number;
  pendingUsers: number;
  openRequests: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [migrateResult, setMigrateResult] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [geohashResult, setGeohashResult] = useState<string | null>(null);
  const [migratingGeohash, setMigratingGeohash] = useState(false);
  const [registrantsResult, setRegistrantsResult] = useState<string | null>(null);
  const [migratingRegistrants, setMigratingRegistrants] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // QRS 관련 상태
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState<string | null>(null);
  const [snapshotting, setSnapshotting] = useState(false);

  // 월별 데이터 확인/생성 상태
  const [monthlyDataResult, setMonthlyDataResult] = useState<string | null>(null);
  const [checkingMonthlyData, setCheckingMonthlyData] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('2026-01');
  const [generatingLeaderboard, setGeneratingLeaderboard] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  const handleMigrateCellId = async () => {
    if (!auth?.currentUser) {
      setMigrateResult('로그인이 필요합니다.');
      return;
    }
    setMigrating(true);
    setMigrateResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/migrate-cellid', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMigrateResult(
        `완료: 전체 ${data.total}개 / 업데이트 ${data.updated}개 / 스킵 ${data.skipped}개 / 실패 ${data.failed}개`
      );
    } catch (err) {
      setMigrateResult(`실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setMigrating(false);
    }
  };

  const handleMigrateGeohash = async () => {
    if (!auth?.currentUser) {
      setGeohashResult('로그인이 필요합니다.');
      return;
    }
    setMigratingGeohash(true);
    setGeohashResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/migrate-geohash', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeohashResult(
        `완료: 전체 ${data.total}개 / 업데이트 ${data.updated}개 / 스킵 ${data.skipped}개 / 실패 ${data.failed}개`
      );
    } catch (err) {
      setGeohashResult(`실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setMigratingGeohash(false);
    }
  };

  const handleMigrateRegistrants = async () => {
    if (!auth?.currentUser) {
      setRegistrantsResult('로그인이 필요합니다.');
      return;
    }

    if (!confirm('모든 장소의 registeredBy를 훈동이 계정으로 설정합니다. 계속하시겠습니까?')) {
      return;
    }

    setMigratingRegistrants(true);
    setRegistrantsResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/migrate-registrants', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRegistrantsResult(
        `완료: 훈동 UID: ${data.hoondongUid}\n전체 ${data.total}개 / 업데이트 ${data.updated}개 / 스킵 ${data.skipped}개`
      );
    } catch (err) {
      setRegistrantsResult(`실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setMigratingRegistrants(false);
    }
  };

  // QRS: Backfill Aggregates
  const handleBackfillAggregates = async () => {
    if (!auth?.currentUser) {
      setBackfillResult('로그인이 필요합니다.');
      return;
    }

    if (!confirm('기존 리뷰 데이터를 기반으로 월별 통계를 생성합니다. 계속하시겠습니까?')) {
      return;
    }

    setBackfilling(true);
    setBackfillResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/backfill-aggregates', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBackfillResult(
        `완료: 처리 ${data.processedReviews}개 / 스킵 ${data.skippedReviews}개 / 저장 ${data.totalWrites}개\n월: ${data.monthKeys?.join(', ') || '없음'}`
      );
    } catch (err) {
      setBackfillResult(`실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setBackfilling(false);
    }
  };

  // QRS: Trigger Snapshot
  const handleTriggerSnapshot = async () => {
    if (!auth?.currentUser) {
      setSnapshotResult('로그인이 필요합니다.');
      return;
    }

    setSnapshotting(true);
    setSnapshotResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/trigger-snapshot', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSnapshotResult(
        `완료: ${data.monthKey}\n리더보드: 종합 ${data.result?.leaderboard?.overallCount || 0}명, 카테고리 챔피언 ${data.result?.leaderboard?.categoryWinnerCount || 0}명\n통계: 리뷰 ${data.result?.serviceStats?.totalReviews || 0}개, 활성 사용자 ${data.result?.serviceStats?.activeUsers || 0}명`
      );
    } catch (err) {
      setSnapshotResult(`실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setSnapshotting(false);
    }
  };

  // 월별 데이터 확인
  const handleCheckMonthlyData = async () => {
    if (!auth?.currentUser) {
      setMonthlyDataResult('로그인이 필요합니다.');
      return;
    }

    setCheckingMonthlyData(true);
    setMonthlyDataResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`/api/admin/check-monthly-data?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const lines = [
        `📅 ${data.month} 데이터 확인 결과:`,
        ``,
        `📊 리더보드: ${data.leaderboard.exists ? '✅ 있음' : '❌ 없음'}`,
      ];

      if (data.leaderboard.exists && data.leaderboard.data) {
        lines.push(`   - 종합 Top: ${data.leaderboard.data.overallCount}명`);
        lines.push(`   - 리뷰왕: ${data.leaderboard.data.reviewKingCount}명`);
        lines.push(`   - 기록왕: ${data.leaderboard.data.recordKingCount}명`);
        lines.push(`   - 카테고리: ${data.leaderboard.data.categoryWinners.join(', ') || '없음'}`);
      }

      lines.push(``);
      lines.push(`👥 사용자 통계: ${data.userStats.exists ? '✅ 있음' : '❌ 없음'}`);
      if (data.userStats.exists) {
        lines.push(`   - 사용자 수: ${data.userStats.userCount}명`);
        if (data.userStats.users.length > 0) {
          lines.push(`   - 샘플: ${data.userStats.users.map((u: { reviews: number }) => `리뷰 ${u.reviews}개`).join(', ')}`);
        }
      }

      setMonthlyDataResult(lines.join('\n'));
    } catch (err) {
      setMonthlyDataResult(`실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setCheckingMonthlyData(false);
    }
  };

  // 리더보드 생성
  const handleGenerateLeaderboard = async () => {
    if (!auth?.currentUser) {
      setGenerateResult('로그인이 필요합니다.');
      return;
    }

    if (!confirm(`${selectedMonth} 리더보드를 생성합니다. 계속하시겠습니까?`)) {
      return;
    }

    setGeneratingLeaderboard(true);
    setGenerateResult(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/admin/generate-leaderboard', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ month: selectedMonth }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.suggestion);

      const lines = [
        `✅ ${data.month} 리더보드 생성 완료!`,
        ``,
        `📊 통계:`,
        `   - 총 사용자: ${data.stats.totalUsers}명`,
        `   - 종합 Top: ${data.stats.overallCount}명`,
        `   - 리뷰왕: ${data.stats.reviewKingCount}명`,
        `   - 기록왕: ${data.stats.recordKingCount}명`,
        `   - 카테고리 챔피언: ${data.stats.categoryWinnerCount}개`,
      ];

      if (data.preview.top3Overall.length > 0) {
        lines.push(``);
        lines.push(`🏆 종합 Top 3:`);
        data.preview.top3Overall.forEach((entry: { nickname: string; value: number }, i: number) => {
          lines.push(`   ${i + 1}위: ${entry.nickname} (${entry.value}점)`);
        });
      }

      setGenerateResult(lines.join('\n'));
    } catch (err) {
      setGenerateResult(`실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setGeneratingLeaderboard(false);
    }
  };

  // 통계 가져오기
  useEffect(() => {
    async function fetchStats() {
      if (!auth?.currentUser || !user || user.role !== 'owner') return;

      setStatsLoading(true);
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.error('Failed to fetch stats');
        }
      } catch (error) {
        console.error('Fetch stats error:', error);
      } finally {
        setStatsLoading(false);
      }
    }

    fetchStats();
  }, [user]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="mt-2 text-gray-600">
          환영합니다, {user?.nickname}님
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          href="/admin/import"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Import</h3>
          </div>
          <p className="text-sm text-gray-600">
            네이버 북마크 JSON 파일을 Firestore로 가져오기
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">사용자 관리</h3>
          </div>
          <p className="text-sm text-gray-600">
            pending 사용자 승인 및 role 관리
          </p>
        </Link>


        <Link
          href="/admin/requests"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">요청 관리</h3>
          </div>
          <p className="text-sm text-gray-600">
            삭제/수정 요청 승인 및 거부
          </p>
        </Link>

        <Link
          href="/leaderboard"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">명예의 전당</h3>
          </div>
          <p className="text-sm text-gray-600">
            리뷰왕, 기록왕, 카테고리 챔피언 리더보드
          </p>
        </Link>

        <Link
          href="/stats"
          className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">서비스 통계</h3>
          </div>
          <p className="text-sm text-gray-600">
            전체 리뷰, 장소, 등급 분포 통계
          </p>
        </Link>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">현황 요약</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">
              {statsLoading ? '-' : (stats?.totalPlaces ?? 0)}
            </p>
            <p className="text-sm text-gray-600 mt-1">전체 장소</p>
          </div>
          <Link
            href="/admin/reviews"
            className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <p className="text-2xl font-bold text-gray-900">
              {statsLoading ? '-' : (stats?.totalReviews ?? 0)}
            </p>
            <p className="text-sm text-gray-600 mt-1">전체 리뷰</p>
          </Link>
          <Link
            href="/admin/users"
            className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <p className="text-2xl font-bold text-gray-900">
              {statsLoading ? '-' : (stats?.pendingUsers ?? 0)}
            </p>
            <p className="text-sm text-gray-600 mt-1">Pending 사용자</p>
          </Link>
          <Link
            href="/admin/requests"
            className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <p className="text-2xl font-bold text-gray-900">
              {statsLoading ? '-' : (stats?.openRequests ?? 0)}
            </p>
            <p className="text-sm text-gray-600 mt-1">열린 요청</p>
          </Link>
        </div>
      </div>

      {/* 데이터 마이그레이션 */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">데이터 마이그레이션</h2>

        {/* cellId 마이그레이션 */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-800 mb-2">cellId 마이그레이션</h3>
          <p className="text-sm text-gray-600 mb-3">
            기존 장소 데이터에 cellId 필드를 추가합니다. (bounds 기반 쿼리용)
          </p>
          <button
            onClick={handleMigrateCellId}
            disabled={migrating}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {migrating ? '마이그레이션 중...' : 'cellId 마이그레이션 실행'}
          </button>
          {migrateResult && (
            <p className={`mt-3 text-sm ${migrateResult.startsWith('실패') ? 'text-red-600' : 'text-green-600'}`}>
              {migrateResult}
            </p>
          )}
        </div>

        {/* geohash 마이그레이션 */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-800 mb-2">geohash 마이그레이션</h3>
          <p className="text-sm text-gray-600 mb-3">
            기존 장소 데이터에 geohash 필드를 추가합니다. (좌표 기반 중복 체크용)
          </p>
          <button
            onClick={handleMigrateGeohash}
            disabled={migratingGeohash}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {migratingGeohash ? '마이그레이션 중...' : 'geohash 마이그레이션 실행'}
          </button>
          {geohashResult && (
            <p className={`mt-3 text-sm ${geohashResult.startsWith('실패') ? 'text-red-600' : 'text-green-600'}`}>
              {geohashResult}
            </p>
          )}
        </div>

        {/* registeredBy 마이그레이션 */}
        <div>
          <h3 className="text-sm font-medium text-gray-800 mb-2">등록자 데이터 설정 (테스트용)</h3>
          <p className="text-sm text-gray-600 mb-3">
            모든 장소의 registeredBy를 훈동이 계정 UUID로 설정합니다. (테스트 데이터 초기화용)
          </p>
          <button
            onClick={handleMigrateRegistrants}
            disabled={migratingRegistrants}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {migratingRegistrants ? '설정 중...' : '훈동이 계정으로 일괄 설정'}
          </button>
          {registrantsResult && (
            <p className={`mt-3 text-sm whitespace-pre-line ${registrantsResult.startsWith('실패') ? 'text-red-600' : 'text-green-600'}`}>
              {registrantsResult}
            </p>
          )}
        </div>
      </div>

      {/* QRS: 리더보드/통계 */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">리더보드 / 통계 (QRS)</h2>

        {/* Backfill Aggregates */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-800 mb-2">1. Backfill Aggregates</h3>
          <p className="text-sm text-gray-600 mb-3">
            기존 리뷰 데이터를 스캔하여 월별 사용자 통계(monthly_user_stats)를 생성합니다. (1회성)
          </p>
          <button
            onClick={handleBackfillAggregates}
            disabled={backfilling}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {backfilling ? 'Backfill 중...' : 'Backfill 실행'}
          </button>
          {backfillResult && (
            <p className={`mt-3 text-sm whitespace-pre-line ${backfillResult.startsWith('실패') ? 'text-red-600' : 'text-green-600'}`}>
              {backfillResult}
            </p>
          )}
        </div>

        {/* Trigger Snapshot */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-800 mb-2">2. Snapshot 트리거</h3>
          <p className="text-sm text-gray-600 mb-3">
            현재 월의 리더보드(monthly_leaderboard)와 서비스 통계(monthly_service_stats)를 생성합니다.
          </p>
          <button
            onClick={handleTriggerSnapshot}
            disabled={snapshotting}
            className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {snapshotting ? 'Snapshot 생성 중...' : 'Snapshot 생성'}
          </button>
          {snapshotResult && (
            <p className={`mt-3 text-sm whitespace-pre-line ${snapshotResult.startsWith('실패') ? 'text-red-600' : 'text-green-600'}`}>
              {snapshotResult}
            </p>
          )}
        </div>

        {/* 월별 데이터 확인 및 생성 */}
        <div>
          <h3 className="text-sm font-medium text-gray-800 mb-2">3. 특정 월 리더보드 생성</h3>
          <p className="text-sm text-gray-600 mb-3">
            과거 월의 monthly_user_stats를 기반으로 리더보드를 생성합니다.
          </p>
          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              placeholder="YYYY-MM"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-32"
            />
            <button
              onClick={handleCheckMonthlyData}
              disabled={checkingMonthlyData}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {checkingMonthlyData ? '확인 중...' : '데이터 확인'}
            </button>
            <button
              onClick={handleGenerateLeaderboard}
              disabled={generatingLeaderboard}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {generatingLeaderboard ? '생성 중...' : '리더보드 생성'}
            </button>
          </div>
          {monthlyDataResult && (
            <pre className={`mt-3 text-sm whitespace-pre-line p-3 bg-gray-50 rounded-lg ${monthlyDataResult.startsWith('실패') ? 'text-red-600' : 'text-gray-700'}`}>
              {monthlyDataResult}
            </pre>
          )}
          {generateResult && (
            <pre className={`mt-3 text-sm whitespace-pre-line p-3 bg-gray-50 rounded-lg ${generateResult.startsWith('실패') ? 'text-red-600' : 'text-green-700'}`}>
              {generateResult}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
