'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RequestStatus } from '@/types';

interface DeleteRequest {
  requestId: string;
  type: string;
  placeId: string;
  placeName: string;
  requestedBy: string;
  requesterNickname: string;
  status: RequestStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export default function AdminPlacesPage() {
  const { firebaseUser } = useAuth();
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | RequestStatus>('open');
  const [processing, setProcessing] = useState<string | null>(null);

  // 삭제 요청 목록 조회
  const fetchRequests = async () => {
    if (!firebaseUser) return;

    setLoading(true);
    setError('');

    try {
      const idToken = await firebaseUser.getIdToken();
      const params = new URLSearchParams({ type: 'place_delete' });
      if (filter !== 'all') {
        params.set('status', filter);
      }

      const response = await fetch(`/api/requests?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '요청 목록을 불러오지 못했습니다.');
      }

      const data = await response.json();
      setRequests(data.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [firebaseUser, filter]);

  // 요청 처리 (승인/거부)
  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    if (!firebaseUser) return;

    const request = requests.find((r) => r.requestId === requestId);
    if (!request) return;

    const actionLabel = action === 'approve' ? '승인' : '거부';
    const confirmed = confirm(
      `"${request.placeName}" 삭제 요청을 ${actionLabel}하시겠습니까?${
        action === 'approve' ? '\n승인 시 장소가 삭제(숨김) 처리됩니다.' : ''
      }`
    );

    if (!confirmed) return;

    setProcessing(requestId);

    try {
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `${actionLabel}에 실패했습니다.`);
      }

      // 목록 갱신
      setRequests((prev) =>
        prev.map((r) =>
          r.requestId === requestId
            ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' }
            : r
        )
      );

      alert(`삭제 요청이 ${actionLabel}되었습니다.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : `${actionLabel} 실패`);
    } finally {
      setProcessing(null);
    }
  };

  // 서버에서 필터링된 결과를 그대로 사용
  const filteredRequests = requests;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'open':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: RequestStatus) => {
    switch (status) {
      case 'open':
        return '대기중';
      case 'approved':
        return '승인됨';
      case 'rejected':
        return '거부됨';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">장소 관리</h1>
        <p className="mt-2 text-gray-600">
          삭제 요청을 확인하고 승인/거부합니다.
        </p>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 flex-wrap">
        {(['open', 'all', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f === 'all'
              ? '전체'
              : f === 'open'
                ? '대기중'
                : f === 'approved'
                  ? '승인됨'
                  : '거부됨'}
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
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center text-gray-500">
          {filter === 'open'
            ? '대기 중인 삭제 요청이 없습니다.'
            : '표시할 요청이 없습니다.'}
        </div>
      ) : (
        /* 요청 리스트 */
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <div
              key={request.requestId}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/places/${request.placeId}`}
                      className="text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate"
                    >
                      {request.placeName}
                    </Link>
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(
                        request.status
                      )}`}
                    >
                      {getStatusLabel(request.status)}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-0.5">
                    <p>
                      요청자: <span className="text-gray-700">{request.requesterNickname}</span>
                    </p>
                    <p>요청일: {formatDate(request.createdAt)}</p>
                    {request.resolvedAt && (
                      <p>처리일: {formatDate(request.resolvedAt)}</p>
                    )}
                  </div>
                </div>

                {/* 액션 버튼 (open 상태만) */}
                {request.status === 'open' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAction(request.requestId, 'approve')}
                      disabled={processing === request.requestId}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {processing === request.requestId ? '처리중...' : '삭제 승인'}
                    </button>
                    <button
                      onClick={() => handleAction(request.requestId, 'reject')}
                      disabled={processing === request.requestId}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {processing === request.requestId ? '처리중...' : '거부'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">삭제 요청 안내</p>
        <ul className="list-disc list-inside space-y-1 text-blue-600">
          <li>멤버가 장소 상세 페이지에서 삭제 요청을 제출할 수 있습니다.</li>
          <li><strong>승인</strong> 시 해당 장소는 삭제(숨김) 처리되어 지도에서 보이지 않습니다.</li>
          <li><strong>거부</strong> 시 요청만 닫히고 장소는 유지됩니다.</li>
        </ul>
      </div>
    </div>
  );
}
