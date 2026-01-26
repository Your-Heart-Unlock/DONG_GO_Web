'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';

interface AdminUser {
  uid: string;
  email: string;
  nickname: string;
  role: UserRole;
  createdAt: string | null;
  lastLoginAt: string | null;
}

export default function AdminUsersPage() {
  const { firebaseUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | UserRole>('all');
  const [updating, setUpdating] = useState<string | null>(null);

  // 사용자 목록 조회
  const fetchUsers = async () => {
    if (!firebaseUser) return;

    setLoading(true);
    setError('');

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch('/api/admin/users', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '사용자 목록을 불러오지 못했습니다.');
      }

      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [firebaseUser]);

  // 역할 변경
  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    if (!firebaseUser) return;

    const user = users.find((u) => u.uid === uid);
    if (!user) return;

    const confirmed = confirm(
      `${user.nickname || user.email}의 역할을 "${user.role}" → "${newRole}"로 변경하시겠습니까?`
    );

    if (!confirmed) return;

    setUpdating(uid);

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(`/api/admin/users/${uid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '역할 변경에 실패했습니다.');
      }

      // 목록 갱신
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u))
      );

      alert('역할이 변경되었습니다.');
    } catch (err) {
      alert(err instanceof Error ? err.message : '역할 변경 실패');
    } finally {
      setUpdating(null);
    }
  };

  // 필터링된 사용자 목록
  const filteredUsers =
    filter === 'all' ? users : users.filter((u) => u.role === filter);

  // 역할별 카운트
  const counts = {
    all: users.length,
    pending: users.filter((u) => u.role === 'pending').length,
    member: users.filter((u) => u.role === 'member').length,
    owner: users.filter((u) => u.role === 'owner').length,
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-100 text-purple-800';
      case 'member':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">사용자 관리</h1>
        <p className="mt-2 text-gray-600">
          사용자 승인 및 역할을 관리합니다.
        </p>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'member', 'owner'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? '전체' : f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
          로딩 중...
        </div>
      ) : (
        /* 사용자 테이블 */
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    역할
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    가입일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    마지막 로그인
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      표시할 사용자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.nickname || '(닉네임 없음)'}
                          </div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeClass(
                            user.role
                          )}`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(user.lastLoginAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {user.role === 'pending' && (
                            <button
                              onClick={() => handleRoleChange(user.uid, 'member')}
                              disabled={updating === user.uid}
                              className="px-3 py-1 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                              {updating === user.uid ? '처리중...' : '승인'}
                            </button>
                          )}
                          {user.role === 'member' && (
                            <button
                              onClick={() => handleRoleChange(user.uid, 'pending')}
                              disabled={updating === user.uid}
                              className="px-3 py-1 text-xs font-medium text-white bg-yellow-600 rounded hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                              {updating === user.uid ? '처리중...' : '강등'}
                            </button>
                          )}
                          {user.role !== 'owner' && (
                            <button
                              onClick={() => handleRoleChange(user.uid, 'owner')}
                              disabled={updating === user.uid}
                              className="px-3 py-1 text-xs font-medium text-purple-600 border border-purple-600 rounded hover:bg-purple-50 disabled:border-gray-300 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                              Owner 지정
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">역할 안내</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600">
          <li><strong>pending</strong>: 승인 대기 (읽기 전용)</li>
          <li><strong>member</strong>: 일반 멤버 (리뷰/방문 작성 가능)</li>
          <li><strong>owner</strong>: 관리자 (모든 권한)</li>
        </ul>
      </div>
    </div>
  );
}
