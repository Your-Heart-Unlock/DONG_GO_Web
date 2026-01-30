'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [migrateResult, setMigrateResult] = useState<string | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [geohashResult, setGeohashResult] = useState<string | null>(null);
  const [migratingGeohash, setMigratingGeohash] = useState(false);
  const [registrantsResult, setRegistrantsResult] = useState<string | null>(null);
  const [migratingRegistrants, setMigratingRegistrants] = useState(false);

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
      </div>

      {/* Stats (Coming Soon) */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">현황 요약</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">-</p>
            <p className="text-sm text-gray-600 mt-1">전체 장소</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">-</p>
            <p className="text-sm text-gray-600 mt-1">전체 리뷰</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">-</p>
            <p className="text-sm text-gray-600 mt-1">Pending 사용자</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-900">-</p>
            <p className="text-sm text-gray-600 mt-1">열린 요청</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4 text-center">
          통계 기능은 추후 구현 예정
        </p>
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
    </div>
  );
}
