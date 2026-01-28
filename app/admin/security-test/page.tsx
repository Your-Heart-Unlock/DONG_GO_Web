'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  collection,
  getDocs,
  query,
  where,
  limit,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface TestResult {
  name: string;
  description: string;
  expected: 'PASS' | 'BLOCK';
  actual: 'PASS' | 'BLOCK' | 'PENDING';
  detail?: string;
}

export default function SecurityTestPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<TestResult[]>([]);
  const [running, setRunning] = useState(false);

  const updateResult = (index: number, actual: 'PASS' | 'BLOCK', detail?: string) => {
    setResults((prev) =>
      prev.map((r, i) => (i === index ? { ...r, actual, detail } : r))
    );
  };

  const runTests = async () => {
    if (!db) return;
    setRunning(true);

    // 테스트 목록 초기화
    const tests: TestResult[] = [
      {
        name: 'places 읽기',
        description: 'places 컬렉션에서 문서 읽기 (모든 사용자 허용)',
        expected: 'PASS',
        actual: 'PENDING',
      },
      {
        name: 'stats 읽기',
        description: 'stats 컬렉션에서 문서 읽기 (모든 사용자 허용)',
        expected: 'PASS',
        actual: 'PENDING',
      },
      {
        name: 'reviews 읽기',
        description: 'reviews 컬렉션 읽기 (member/owner만 허용)',
        expected: user?.role === 'member' || user?.role === 'owner' ? 'PASS' : 'BLOCK',
        actual: 'PENDING',
      },
      {
        name: 'reviews 생성 (본인 uid)',
        description: '본인 uid로 리뷰 생성 시도 (member/owner만 허용)',
        expected: user?.role === 'member' || user?.role === 'owner' ? 'PASS' : 'BLOCK',
        actual: 'PENDING',
      },
      {
        name: 'reviews 생성 (타인 uid 위조)',
        description: '타인 uid로 리뷰 생성 시도 (항상 차단)',
        expected: 'BLOCK',
        actual: 'PENDING',
      },
      {
        name: 'admin_logs 읽기',
        description: 'admin_logs 컬렉션 읽기 (owner만 허용)',
        expected: user?.role === 'owner' ? 'PASS' : 'BLOCK',
        actual: 'PENDING',
      },
      {
        name: 'config 읽기',
        description: 'config 컬렉션 읽기 (모든 사용자 허용)',
        expected: 'PASS',
        actual: 'PENDING',
      },
      {
        name: 'config 쓰기',
        description: 'config 컬렉션 쓰기 시도 (owner만 허용)',
        expected: user?.role === 'owner' ? 'PASS' : 'BLOCK',
        actual: 'PENDING',
      },
    ];

    setResults(tests);

    // --- Test 0: places 읽기 ---
    try {
      const q = query(collection(db, 'places'), limit(1));
      await getDocs(q);
      updateResult(0, 'PASS', '정상적으로 places 문서를 읽었습니다.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateResult(0, 'BLOCK', msg);
    }

    // --- Test 1: stats 읽기 ---
    try {
      const q = query(collection(db, 'stats'), limit(1));
      await getDocs(q);
      updateResult(1, 'PASS', '정상적으로 stats 문서를 읽었습니다.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateResult(1, 'BLOCK', msg);
    }

    // --- Test 2: reviews 읽기 ---
    try {
      const q = query(collection(db, 'reviews'), limit(1));
      await getDocs(q);
      updateResult(2, 'PASS', '정상적으로 reviews 문서를 읽었습니다.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateResult(2, 'BLOCK', msg);
    }

    // --- Test 3: reviews 생성 (본인 uid) ---
    let createdReviewId: string | null = null;
    try {
      // 테스트용 장소 ID 찾기
      const placesQ = query(collection(db, 'places'), limit(1));
      const placesSnap = await getDocs(placesQ);
      const testPlaceId = placesSnap.docs[0]?.id || '__test_place__';

      const reviewRef = await addDoc(collection(db, 'reviews'), {
        placeId: testPlaceId,
        uid: user?.uid || '',
        ratingTier: 'B',
        oneLineReview: '__SECURITY_TEST__ (자동 삭제됩니다)',
        tags: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdReviewId = reviewRef.id;
      updateResult(3, 'PASS', `리뷰 생성 성공 (ID: ${reviewRef.id})`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateResult(3, 'BLOCK', msg);
    }

    // --- Test 4: reviews 생성 (타인 uid 위조) ---
    try {
      const placesQ = query(collection(db, 'places'), limit(1));
      const placesSnap = await getDocs(placesQ);
      const testPlaceId = placesSnap.docs[0]?.id || '__test_place__';

      await addDoc(collection(db, 'reviews'), {
        placeId: testPlaceId,
        uid: '__fake_uid_not_me__',
        ratingTier: 'A',
        oneLineReview: '__SECURITY_TEST_SPOOFED__',
        tags: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      updateResult(4, 'PASS', '타인 uid로 생성 성공 (규칙 미적용 가능성!)');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateResult(4, 'BLOCK', '타인 uid 위조 차단됨: ' + msg);
    }

    // --- Test 5: admin_logs 읽기 ---
    try {
      const q = query(collection(db, 'admin_logs'), limit(1));
      await getDocs(q);
      updateResult(5, 'PASS', '정상적으로 admin_logs를 읽었습니다.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateResult(5, 'BLOCK', msg);
    }

    // --- Test 6: config 읽기 ---
    try {
      const configRef = doc(db, 'config', 'ratings');
      await getDoc(configRef);
      updateResult(6, 'PASS', 'config/ratings 문서를 읽었습니다.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateResult(6, 'BLOCK', msg);
    }

    // --- Test 7: config 쓰기 ---
    try {
      const configRef = doc(db, 'config', '__security_test__');
      await updateDoc(configRef, {
        test: true,
        updatedAt: serverTimestamp(),
      });
      updateResult(7, 'PASS', 'config 문서 쓰기 성공');
      // 테스트 문서 삭제
      try {
        await deleteDoc(configRef);
      } catch { /* 삭제 실패는 무시 */ }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      updateResult(7, 'BLOCK', msg);
    }

    // --- 정리: 테스트용 리뷰 삭제 ---
    if (createdReviewId) {
      try {
        await deleteDoc(doc(db, 'reviews', createdReviewId));
      } catch {
        // 삭제 실패는 무시 (권한 문제일 수 있음)
      }
    }

    setRunning(false);
  };

  const getStatusIcon = (result: TestResult) => {
    if (result.actual === 'PENDING') return '⏳';
    if (result.actual === result.expected) return '✅';
    return '❌';
  };

  const getStatusText = (result: TestResult) => {
    if (result.actual === 'PENDING') return '대기중';
    if (result.actual === result.expected) return '정상';
    return '이상 감지';
  };

  const passCount = results.filter((r) => r.actual !== 'PENDING' && r.actual === r.expected).length;
  const failCount = results.filter((r) => r.actual !== 'PENDING' && r.actual !== r.expected).length;
  const pendingCount = results.filter((r) => r.actual === 'PENDING').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">보안 규칙 테스트</h1>
          <p className="text-sm text-gray-500 mt-1">
            Firestore Security Rules가 올바르게 적용되었는지 검증합니다.
          </p>
        </div>
        <button
          onClick={runTests}
          disabled={running}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {running ? '테스트 실행 중...' : '테스트 실행'}
        </button>
      </div>

      {/* 현재 사용자 정보 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">현재 사용자 정보</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">닉네임:</span>{' '}
            <span className="font-medium">{user?.nickname || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">역할:</span>{' '}
            <span className={`font-medium ${
              user?.role === 'owner' ? 'text-red-600' :
              user?.role === 'member' ? 'text-blue-600' :
              'text-yellow-600'
            }`}>
              {user?.role || 'guest'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">UID:</span>{' '}
            <span className="font-mono text-xs">{user?.uid || '-'}</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-400">
          다른 역할로 테스트하려면 해당 역할의 계정으로 로그인 후 이 페이지에 직접 접근하세요.
          (pending 계정은 /admin 접근이 차단되므로, 브라우저 콘솔에서 직접 Firestore SDK로 테스트하세요.)
        </p>
      </div>

      {/* 테스트 결과 요약 */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">결과 요약</h2>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{passCount}</p>
              <p className="text-sm text-gray-500">정상</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{failCount}</p>
              <p className="text-sm text-gray-500">이상</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-400">{pendingCount}</p>
              <p className="text-sm text-gray-500">대기</p>
            </div>
          </div>
          {failCount > 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              보안 규칙에 문제가 발견되었습니다. 아래 상세 결과를 확인하고 Firebase Console에서 규칙을 점검하세요.
            </div>
          )}
          {failCount === 0 && pendingCount === 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              모든 보안 규칙이 정상 작동하고 있습니다.
            </div>
          )}
        </div>
      )}

      {/* 테스트 상세 결과 */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">상세 결과</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {results.map((result, i) => (
              <div key={i} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0 mt-0.5">{getStatusIcon(result)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{result.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        result.actual === 'PENDING' ? 'bg-gray-100 text-gray-600' :
                        result.actual === result.expected ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {getStatusText(result)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{result.description}</p>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span className="text-gray-400">
                        예상: <span className={result.expected === 'PASS' ? 'text-green-600' : 'text-red-600'}>{result.expected === 'PASS' ? '허용' : '차단'}</span>
                      </span>
                      <span className="text-gray-400">
                        실제: <span className={
                          result.actual === 'PENDING' ? 'text-gray-500' :
                          result.actual === 'PASS' ? 'text-green-600' : 'text-red-600'
                        }>{result.actual === 'PENDING' ? '대기' : result.actual === 'PASS' ? '허용' : '차단'}</span>
                      </span>
                    </div>
                    {result.detail && (
                      <p className="mt-1 text-xs text-gray-400 font-mono break-all">
                        {result.detail}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 수동 테스트 가이드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">수동 테스트 가이드</h2>
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <h3 className="font-medium text-gray-800">1. pending/guest 테스트</h3>
            <p className="mt-1">
              pending 계정으로 로그인 후 브라우저 콘솔에서 다음을 실행하세요:
            </p>
            <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-x-auto font-mono">
{`// reviews 읽기 시도 (차단되어야 함)
const { collection, getDocs, query, limit } = await import('firebase/firestore');
const { db } = await import('/lib/firebase/client');
try {
  const snap = await getDocs(query(collection(db, 'reviews'), limit(1)));
  console.log('❌ 읽기 성공 - 규칙 문제!', snap.size);
} catch (e) {
  console.log('✅ 읽기 차단됨:', e.message);
}`}
            </pre>
          </div>
          <div>
            <h3 className="font-medium text-gray-800">2. member 타인 리뷰 수정 테스트</h3>
            <p className="mt-1">
              member 계정으로 로그인 후, 타인이 작성한 리뷰의 ID로 수정을 시도하세요:
            </p>
            <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-x-auto font-mono">
{`// 타인 리뷰 수정 시도 (차단되어야 함)
const { doc, updateDoc } = await import('firebase/firestore');
const { db } = await import('/lib/firebase/client');
try {
  await updateDoc(doc(db, 'reviews', '<타인_리뷰_ID>'), {
    oneLineReview: '해킹 테스트'
  });
  console.log('❌ 수정 성공 - 규칙 문제!');
} catch (e) {
  console.log('✅ 수정 차단됨:', e.message);
}`}
            </pre>
          </div>
          <div>
            <h3 className="font-medium text-gray-800">3. 비로그인 상태 테스트</h3>
            <p className="mt-1">
              로그아웃 상태에서 <code className="px-1 py-0.5 bg-gray-100 rounded">/places/[placeId]</code> 페이지를 직접 접근하여
              리뷰 섹션이 잠금 상태로 표시되는지 확인하세요.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
