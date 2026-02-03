'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { auth } from '@/lib/firebase/client';
import { CategoryKey } from '@/types';
import { CATEGORY_LABELS, ALL_CATEGORY_KEYS } from '@/lib/utils/categoryIcon';

interface PlaceItem {
  placeId: string;
  name: string;
  address: string;
  category: string;
  categoryKey: CategoryKey;
  source: string;
  mapProvider?: string;
}

interface LLMResponse {
  placeId: string;
  categoryKey: CategoryKey;
}

export default function AdminCategoriesPage() {
  const { user } = useAuth();
  const [places, setPlaces] = useState<PlaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'idle'>('idle');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const [llmInput, setLlmInput] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  // 장소 목록 불러오기
  const fetchPlaces = async (append = false) => {
    if (!auth?.currentUser) return;

    setLoading(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const params = new URLSearchParams({
        limit: '50',
        filter,
        ...(append && cursor ? { cursor } : {}),
      });

      const response = await fetch(`/api/admin/places?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch places');

      const data = await response.json();

      if (append) {
        setPlaces(prev => [...prev, ...data.places]);
      } else {
        setPlaces(data.places);
      }

      setCursor(data.pagination.nextCursor);
      setHasMore(data.pagination.hasMore);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error('Fetch places error:', error);
      alert('장소 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // LLM용 데이터 복사
  const copyForLLM = () => {
    const data = places.map(p => ({
      placeId: p.placeId,
      name: p.name,
      address: p.address,
      currentCategory: p.category,
    }));

    const categories = ALL_CATEGORY_KEYS.filter(k => k !== 'Idle').map(k => ({
      key: k,
      label: CATEGORY_LABELS[k],
    }));

    const prompt = `다음 식당/장소 목록의 카테고리를 분류해주세요.

가능한 카테고리:
${categories.map(c => `- ${c.key}: ${c.label}`).join('\n')}

장소 목록:
${JSON.stringify(data, null, 2)}

응답 형식 (JSON 배열):
[
  { "placeId": "xxx", "categoryKey": "Korea" },
  { "placeId": "yyy", "categoryKey": "Japan" },
  ...
]

각 장소의 이름과 주소를 보고 가장 적합한 카테고리를 선택해주세요.
- 한식당, 국밥, 찌개 등 → Korea
- 중국집, 짜장면, 마라탕 등 → China
- 일식, 초밥, 라멘 등 → Japan
- 양식, 파스타, 스테이크 등 → West
- 베트남, 태국, 인도 등 동남아 음식 → Asian
- 분식, 떡볶이, 김밥, 편의점 등 → Snack
- 고깃집, 삼겹살, 갈비 등 → Meat
- 횟집, 해산물, 조개구이 등 → Sea
- 카페, 디저트, 빵집 등 → Cafe
- 술집, 바, 호프 등 → Beer
- 위 카테고리에 맞지 않는 경우 → Other`;

    navigator.clipboard.writeText(prompt);
    alert('LLM 프롬프트가 클립보드에 복사되었습니다.');
  };

  // LLM 응답 파싱 및 적용
  const applyLLMResponse = async () => {
    if (!auth?.currentUser || !llmInput.trim()) return;

    setUpdating(true);
    setUpdateResult(null);

    try {
      // JSON 배열 추출 (마크다운 코드블록 안에 있을 수 있음)
      let jsonStr = llmInput.trim();

      // 마크다운 코드블록 제거
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      }

      // JSON 배열 찾기
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (!arrayMatch) {
        throw new Error('JSON 배열을 찾을 수 없습니다.');
      }

      const updates: LLMResponse[] = JSON.parse(arrayMatch[0]);

      // 유효성 검사
      const validUpdates = updates.filter(u => {
        const validCategory = ALL_CATEGORY_KEYS.includes(u.categoryKey);
        const placeExists = places.some(p => p.placeId === u.placeId);
        return validCategory && placeExists;
      });

      if (validUpdates.length === 0) {
        throw new Error('유효한 업데이트가 없습니다.');
      }

      // API 호출
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/places/categories', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ updates: validUpdates }),
      });

      if (!response.ok) throw new Error('Failed to update categories');

      const result = await response.json();
      setUpdateResult(`${result.updated}개 장소의 카테고리가 업데이트되었습니다.`);

      // 로컬 상태 업데이트
      setPlaces(prev =>
        prev.map(p => {
          const update = validUpdates.find(u => u.placeId === p.placeId);
          if (update) {
            return {
              ...p,
              categoryKey: update.categoryKey,
              category: CATEGORY_LABELS[update.categoryKey],
            };
          }
          return p;
        })
      );

      setLlmInput('');
    } catch (error) {
      console.error('Apply LLM response error:', error);
      setUpdateResult(`오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setUpdating(false);
    }
  };

  // 개별 카테고리 수정
  const updateSingleCategory = async (placeId: string, categoryKey: CategoryKey) => {
    if (!auth?.currentUser) return;

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/admin/places/categories', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          updates: [{ placeId, categoryKey }],
        }),
      });

      if (!response.ok) throw new Error('Failed to update category');

      // 로컬 상태 업데이트
      setPlaces(prev =>
        prev.map(p =>
          p.placeId === placeId
            ? { ...p, categoryKey, category: CATEGORY_LABELS[categoryKey] }
            : p
        )
      );
    } catch (error) {
      console.error('Update category error:', error);
      alert('카테고리 업데이트에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">카테고리 관리</h1>
        <div className="text-sm text-gray-500">
          총 {total}개 장소
        </div>
      </div>

      {/* 컨트롤 영역 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* 필터 선택 */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'idle')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="idle">미분류만</option>
            <option value="all">전체</option>
          </select>

          {/* 불러오기 버튼 */}
          <button
            onClick={() => fetchPlaces(false)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '불러오는 중...' : '장소 불러오기'}
          </button>

          {/* LLM용 복사 버튼 */}
          {places.length > 0 && (
            <button
              onClick={copyForLLM}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
            >
              LLM 프롬프트 복사 ({places.length}개)
            </button>
          )}
        </div>
      </div>

      {/* LLM 응답 입력 영역 */}
      {places.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">LLM 응답 적용</h2>
          <textarea
            value={llmInput}
            onChange={(e) => setLlmInput(e.target.value)}
            placeholder="LLM의 JSON 응답을 여기에 붙여넣으세요..."
            className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm font-mono resize-none"
          />
          <div className="mt-3 flex items-center gap-4">
            <button
              onClick={applyLLMResponse}
              disabled={updating || !llmInput.trim()}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {updating ? '적용 중...' : '카테고리 적용'}
            </button>
            {updateResult && (
              <span className={`text-sm ${updateResult.startsWith('오류') ? 'text-red-600' : 'text-green-600'}`}>
                {updateResult}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 장소 목록 테이블 */}
      {places.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주소</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">변경</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {places.map((place) => (
                  <tr key={place.placeId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="max-w-[200px] truncate" title={place.name}>
                        {place.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div className="max-w-[250px] truncate" title={place.address}>
                        {place.address}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                        place.categoryKey === 'Idle'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {place.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={place.categoryKey}
                        onChange={(e) => updateSingleCategory(place.placeId, e.target.value as CategoryKey)}
                        className="text-xs px-2 py-1 border border-gray-300 rounded"
                      >
                        {ALL_CATEGORY_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {CATEGORY_LABELS[key]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 더 불러오기 */}
          {hasMore && (
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => fetchPlaces(true)}
                disabled={loading}
                className="w-full px-4 py-2 text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {loading ? '불러오는 중...' : '더 불러오기'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && places.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-gray-500">장소를 불러오려면 &quot;장소 불러오기&quot; 버튼을 클릭하세요.</p>
        </div>
      )}
    </div>
  );
}
