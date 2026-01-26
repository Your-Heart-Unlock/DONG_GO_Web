'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import {
  parseImportJSON,
  validateImportRows,
  calculatePreviewSummary,
} from '@/lib/admin/importParser';
import { ImportRow, ImportPreviewRow, ImportDuplicatePolicy } from '@/types';

export default function AdminImportPage() {
  const { firebaseUser } = useAuth();

  // Step 1: Input
  const [jsonText, setJsonText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  // Step 2: Preview
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [duplicatePolicy, setDuplicatePolicy] = useState<ImportDuplicatePolicy>('SKIP');

  // Step 3: Commit
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any>(null);

  const handleParse = async () => {
    setParseError('');
    setParsing(true);

    try {
      // 1. JSON 파싱
      const rows = parseImportJSON(jsonText);

      if (rows.length === 0) {
        throw new Error('파싱된 데이터가 없습니다.');
      }

      // 2. 기존 placeId 조회
      if (!db) {
        throw new Error('Firestore가 초기화되지 않았습니다.');
      }

      const placesSnapshot = await getDocs(collection(db, 'places'));
      const existingPlaceIds = new Set<string>(
        placesSnapshot.docs.map((doc) => doc.id)
      );

      // 3. 검증 및 Preview
      const validated = validateImportRows(rows, existingPlaceIds);
      setPreviewRows(validated);
    } catch (error: any) {
      setParseError(error.message || '파싱 중 오류가 발생했습니다.');
    } finally {
      setParsing(false);
    }
  };

  const handleCommit = async () => {
    if (!firebaseUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    const okRows = previewRows.filter((p) => p.status === 'OK').map((p) => p.row);
    const duplicateRows =
      duplicatePolicy === 'UPDATE'
        ? previewRows.filter((p) => p.status === 'DUPLICATE').map((p) => p.row)
        : [];

    const rowsToCommit = [...okRows, ...duplicateRows];

    if (rowsToCommit.length === 0) {
      alert('커밋할 데이터가 없습니다.');
      return;
    }

    const confirmed = confirm(
      `${rowsToCommit.length}개의 장소를 Firestore에 등록하시겠습니까?\n\n` +
        `- 신규: ${okRows.length}개\n` +
        `- 업데이트: ${duplicateRows.length}개`
    );

    if (!confirmed) return;

    setCommitting(true);
    setCommitResult(null);

    try {
      // Firebase ID Token 가져오기
      const idToken = await firebaseUser.getIdToken();

      const response = await fetch('/api/admin/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          rows: rowsToCommit,
          duplicatePolicy,
          ownerUid: firebaseUser.uid,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import 실패');
      }

      const result = await response.json();
      setCommitResult(result);

      // 성공 시 입력 초기화
      setJsonText('');
      setPreviewRows([]);
    } catch (error: any) {
      alert(`Import 실패: ${error.message}`);
    } finally {
      setCommitting(false);
    }
  };

  const summary = previewRows.length > 0 ? calculatePreviewSummary(previewRows) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Import 장소</h1>
        <p className="mt-2 text-gray-600">
          네이버 지도 북마크 JSON을 Firestore로 가져옵니다.
        </p>
      </div>

      {/* Result */}
      {commitResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-green-900 mb-3">✅ Import 완료</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-green-700 font-medium">전체</p>
              <p className="text-2xl font-bold text-green-900">{commitResult.total}</p>
            </div>
            <div>
              <p className="text-green-700 font-medium">생성</p>
              <p className="text-2xl font-bold text-green-900">{commitResult.created}</p>
            </div>
            <div>
              <p className="text-green-700 font-medium">업데이트</p>
              <p className="text-2xl font-bold text-green-900">{commitResult.updated}</p>
            </div>
            <div>
              <p className="text-green-700 font-medium">스킵</p>
              <p className="text-2xl font-bold text-green-900">{commitResult.skipped}</p>
            </div>
            <div>
              <p className="text-green-700 font-medium">실패</p>
              <p className="text-2xl font-bold text-red-600">{commitResult.failed}</p>
            </div>
          </div>
          {commitResult.errors && commitResult.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-red-700">에러:</p>
              <ul className="mt-2 text-xs text-red-600 space-y-1">
                {commitResult.errors.slice(0, 10).map((err: string, i: number) => (
                  <li key={i}>• {err}</li>
                ))}
                {commitResult.errors.length > 10 && (
                  <li>... 외 {commitResult.errors.length - 10}개</li>
                )}
              </ul>
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            새 Import 시작
          </button>
        </div>
      )}

      {/* Step 1: Input */}
      {!commitResult && previewRows.length === 0 && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            1. JSON 입력
          </h2>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder='{"folder": {...}, "bookmarkList": [...]}'
            className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={parsing}
          />
          {parseError && (
            <p className="mt-2 text-sm text-red-600">{parseError}</p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleParse}
              disabled={!jsonText.trim() || parsing}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {parsing ? '파싱 중...' : 'Preview 생성'}
            </button>
            <button
              onClick={() => setJsonText('')}
              disabled={parsing}
              className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              초기화
            </button>
          </div>
          <div className="mt-4 text-xs text-gray-500 space-y-1">
            <p>• 네이버 지도 북마크 Export JSON 또는 ImportRow 배열 지원</p>
            <p>• /initial_data/ 폴더의 JSON 파일 내용을 복사해서 붙여넣으세요</p>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {!commitResult && previewRows.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              2. Preview 및 설정
            </h2>

            {/* Summary */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                  <p className="text-sm text-gray-600 mt-1">전체</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{summary.ok}</p>
                  <p className="text-sm text-gray-600 mt-1">신규 (OK)</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{summary.duplicate}</p>
                  <p className="text-sm text-gray-600 mt-1">중복</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{summary.invalid}</p>
                  <p className="text-sm text-gray-600 mt-1">오류</p>
                </div>
              </div>
            )}

            {/* Duplicate Policy */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                중복 처리 정책
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="SKIP"
                    checked={duplicatePolicy === 'SKIP'}
                    onChange={(e) =>
                      setDuplicatePolicy(e.target.value as ImportDuplicatePolicy)
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    SKIP (기존 유지, 권장)
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="UPDATE"
                    checked={duplicatePolicy === 'UPDATE'}
                    onChange={(e) =>
                      setDuplicatePolicy(e.target.value as ImportDuplicatePolicy)
                    }
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    UPDATE (기존 데이터 덮어쓰기)
                  </span>
                </label>
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">상태</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">장소명</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">주소</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">카테고리</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {previewRows.slice(0, 100).map((preview, idx) => (
                    <tr key={idx} className={
                      preview.status === 'INVALID' ? 'bg-red-50' :
                      preview.status === 'DUPLICATE' ? 'bg-yellow-50' :
                      ''
                    }>
                      <td className="px-4 py-2">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          preview.status === 'OK' ? 'bg-green-100 text-green-800' :
                          preview.status === 'DUPLICATE' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {preview.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{preview.row.name}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">{preview.row.address}</td>
                      <td className="px-4 py-2 text-xs">{preview.row.category}</td>
                      <td className="px-4 py-2 text-xs text-red-600">{preview.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewRows.length > 100 && (
                <div className="p-3 bg-gray-50 text-center text-xs text-gray-600">
                  ... 외 {previewRows.length - 100}개 (최대 100개만 표시)
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleCommit}
              disabled={committing || summary?.ok === 0}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {committing ? 'Commit 중...' : `Commit (${summary?.ok || 0}개 장소)`}
            </button>
            <button
              onClick={() => {
                setPreviewRows([]);
                setJsonText('');
              }}
              disabled={committing}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </>
      )}
    </div>
  );
}
