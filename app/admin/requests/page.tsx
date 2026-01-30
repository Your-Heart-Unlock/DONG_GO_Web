'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';

interface Request {
  requestId: string;
  type: 'place_delete' | 'place_edit';
  placeId: string;
  placeName: string;
  requestedBy: string;
  requesterNickname: string;
  payload: any;
  status: 'open' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export default function RequestsManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'approved' | 'rejected'>('open');
  const [typeFilter, setTypeFilter] = useState<'all' | 'place_delete' | 'place_edit'>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user || user.role !== 'owner') {
      router.push('/');
      return;
    }

    async function fetchRequests() {
      if (!auth?.currentUser) return;

      setLoading(true);
      try {
        const token = await auth.currentUser.getIdToken();
        const params = new URLSearchParams();

        if (filter !== 'all') {
          params.set('status', filter);
        }

        if (typeFilter !== 'all') {
          params.set('type', typeFilter);
        }

        const response = await fetch(`/api/requests?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setRequests(data.requests || []);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to fetch requests:', errorData);
        }
      } catch (error) {
        console.error('Fetch requests error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, [user, authLoading, router, filter, typeFilter]);

  async function handleApprove(requestId: string) {
    if (!confirm('이 요청을 승인하시겠습니까?')) return;

    if (!auth?.currentUser) return;

    setProcessingId(requestId);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (response.ok) {
        alert('요청이 승인되었습니다.');
        // 필터가 'open'이면 목록에서 제거, 아니면 상태만 업데이트
        if (filter === 'open') {
          setRequests(prev => prev.filter(r => r.requestId !== requestId));
        } else {
          setRequests(prev => prev.map(r =>
            r.requestId === requestId
              ? { ...r, status: 'approved' as const }
              : r
          ));
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || '승인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Approve error:', error);
      alert('승인에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(requestId: string) {
    if (!confirm('이 요청을 거부하시겠습니까?')) return;

    if (!auth?.currentUser) return;

    setProcessingId(requestId);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'reject' }),
      });

      if (response.ok) {
        alert('요청이 거부되었습니다.');
        // 필터가 'open'이면 목록에서 제거, 아니면 상태만 업데이트
        if (filter === 'open') {
          setRequests(prev => prev.filter(r => r.requestId !== requestId));
        } else {
          setRequests(prev => prev.map(r =>
            r.requestId === requestId
              ? { ...r, status: 'rejected' as const }
              : r
          ));
        }
      } else {
        const errorData = await response.json();
        alert(errorData.error || '거부에 실패했습니다.');
      }
    } catch (error) {
      console.error('Reject error:', error);
      alert('거부에 실패했습니다.');
    } finally {
      setProcessingId(null);
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'place_delete':
        return '삭제';
      case 'place_edit':
        return '수정';
      default:
        return type;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'open':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">대기중</span>;
      case 'approved':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">승인됨</span>;
      case 'rejected':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">거부됨</span>;
      default:
        return null;
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">요청 관리</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* 필터 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                상태
              </label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="open">대기중</option>
                <option value="approved">승인됨</option>
                <option value="rejected">거부됨</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                요청 타입
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">전체</option>
                <option value="place_delete">삭제</option>
                <option value="place_edit">수정</option>
              </select>
            </div>
          </div>
        </div>

        {/* 요청 목록 */}
        {requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500">요청이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.requestId}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        {getTypeLabel(request.type)}
                      </span>
                      {getStatusBadge(request.status)}
                    </div>
                    <Link
                      href={`/places/${request.placeId}`}
                      className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {request.placeName}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">
                      요청자: {request.requesterNickname}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(request.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                </div>

                {/* 요청 상세 정보 */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  {request.type === 'place_delete' && request.payload?.reason && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">삭제 사유</p>
                      <p className="text-sm text-gray-600">{request.payload.reason}</p>
                    </div>
                  )}
                  {request.type === 'place_edit' && request.payload && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">카테고리 변경</p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded">
                          {request.payload.oldCategory}
                        </span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded font-medium">
                          {request.payload.category}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 승인/거부 버튼 (open 상태만) */}
                {request.status === 'open' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReject(request.requestId)}
                      disabled={processingId === request.requestId}
                      className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === request.requestId ? '처리 중...' : '거부'}
                    </button>
                    <button
                      onClick={() => handleApprove(request.requestId)}
                      disabled={processingId === request.requestId}
                      className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processingId === request.requestId ? '처리 중...' : '승인'}
                    </button>
                  </div>
                )}

                {/* 처리 완료 정보 */}
                {request.status !== 'open' && request.resolvedAt && (
                  <p className="text-xs text-gray-400 mt-4">
                    처리일: {new Date(request.resolvedAt).toLocaleString('ko-KR')}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
