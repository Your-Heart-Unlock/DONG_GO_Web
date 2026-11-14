'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ALL_CATEGORY_KEYS, CATEGORY_LABELS } from '@/lib/utils/categoryIcon';
import { CategoryKey } from '@/types';
import { buildCategoryPrompt, parseCategoryResponse, isLLMCandidate, CategoryPlace, CategoryProposal } from '@/lib/admin/llmCategories';

type Proposal = CategoryProposal & { name?: string; edited?: boolean; classification?: { reason: string } };
export default function AdminCategoriesPage() {
  const { firebaseUser } = useAuth();
  const [places, setPlaces] = useState<CategoryPlace[]>([]);
  const [filter, setFilter] = useState('idle');
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<Proposal[]>([]);
  const [source, setSource] = useState<'llm'|'rule'>('llm');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const llmCount = places.filter(isLLMCandidate).length;
  async function api(url: string, body?: object, method = 'POST') {
    if (!firebaseUser) throw new Error('로그인이 필요합니다.');
    const response = await fetch(url, { method: body ? method : 'GET', headers: { Authorization: `Bearer ${await firebaseUser.getIdToken()}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || '요청 실패'); return data;
  }
  async function run(fn: () => Promise<void>) { setBusy(true); setMessage(''); try { await fn(); } catch(e) { setMessage(String(e)); } finally { setBusy(false); } }
  async function load(append = false) {
    const data = await api(`/api/admin/places?limit=50&filter=${filter}${append && cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    setPlaces(prev => append ? [...prev, ...data.places] : data.places); setTotal(data.pagination.total); setCursor(data.pagination.hasMore ? data.pagination.nextCursor : null); setPending([]);
  }
  async function previewRules() {
    const data = await api('/api/admin/places/categories', { action: 'preview' });
    setSource('rule'); setPending(data.proposals.map((p: Proposal) => ({ ...p, reason: p.classification?.reason || '' })));
    setMessage(`보정 후보 ${data.proposals.length}개. 미분류로 남는 항목도 포함합니다. 아직 저장하지 않았습니다.`);
  }
  async function apply() {
    if (!pending.length || !confirm(`${pending.length}개 검토 결과를 저장할까요?`)) return;
    let saved = 0;
    try {
      for (const group of [pending.filter(p => !p.edited), pending.filter(p => p.edited)]) {
        for (let i=0; i<group.length; i+=200) {
          const chunk = group.slice(i,i+200);
          await api('/api/admin/places/categories', { source: chunk[0].edited ? 'manual' : source, updates: chunk }, 'PATCH');
          saved += chunk.length;
        }
      }
    } catch(e) {
      setPending([]);
      throw new Error(`${saved}개 저장됨. 나머지는 적용되지 않았습니다. 목록을 다시 불러와 검토하세요. ${String(e)}`);
    }
    setPending([]); await load(); setMessage('저장했습니다.');
  }
  async function manual(p: CategoryPlace, categoryKey: CategoryKey) {
    await api('/api/admin/places/categories', { source: 'manual', updates: [{ placeId: p.placeId, categoryKey, expectedCategoryKey: p.categoryKey }] }, 'PATCH');
    await load();
  }
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">카테고리 관리 · {total}개</h1>
    <p>미분류·검토 대상에는 과거 Other로 저장된 음식점이 포함됩니다. 확인된 기타 장소와 수동 분류는 제외합니다.</p>
    <select aria-label="분류 필터" value={filter} disabled={busy} onChange={e => { setFilter(e.target.value); setPlaces([]); setCursor(null); setPending([]); }}><option value="idle">미분류 / 검토 필요</option><option value="all">전체</option></select>
    <button className="border p-2" disabled={busy} onClick={() => run(() => load())}>장소 불러오기</button>
    <button className="border p-2" disabled={busy} onClick={() => run(previewRules)}>기존 데이터 규칙 보정 미리보기</button>
    <button className="border p-2" disabled={busy || !llmCount} onClick={() => run(async () => { await navigator.clipboard.writeText(buildCategoryPrompt(places)); setMessage(`규칙 미분류 ${llmCount}개의 프롬프트를 복사했습니다. 외부 전송은 직접 선택한 서비스에 붙여넣을 때 이루어집니다.`); })}>규칙 미분류만 LLM 프롬프트 복사 ({llmCount}개)</button>
    <p>규칙 보정 미리보기에서 먼저 분류할 수 있는 장소를 처리하세요. LLM에는 현재 규칙으로도 분류되지 않는 장소만 포함됩니다.</p>
    <p>서버에서 LLM을 호출하지 않습니다. API 키나 유료 API가 필요하지 않습니다.</p>
    <textarea aria-label="LLM JSON 응답" className="w-full h-32 border p-2" value={input} onChange={e => { setInput(e.target.value); setPending([]); }} placeholder="LLM JSON 응답 (placeId, categoryKey, reason)" />
    <button className="border p-2" disabled={busy || !input.trim()} onClick={() => run(async () => { setPending([]); const rows = parseCategoryResponse(input, places); setSource('llm'); setPending(rows); })}>LLM 결과 미리보기</button>
    {message && <p role="status">{message}</p>}
    {!!pending.length && <section className="border p-3 space-y-3"><h2>저장 전 검토 ({pending.length}개)</h2><p>체크를 해제하면 이번 적용에서 제외됩니다. 모든 항목을 검토한 뒤 저장하세요.</p>
      <div className="max-h-96 overflow-auto">{pending.map(p => <div key={p.placeId} className="border-b p-2">
        <input aria-label={`${p.placeId} 적용 제외`} type="checkbox" checked disabled={busy} onChange={() => setPending(prev => prev.filter(v => v.placeId !== p.placeId))} />
        {p.name || places.find(v => v.placeId === p.placeId)?.name} ({p.placeId}) {CATEGORY_LABELS[p.expectedCategoryKey]} →
        <select aria-label={`${p.placeId} 제안 분류`} value={p.categoryKey} disabled={busy || source === 'rule'} onChange={e => setPending(prev => prev.map(v => v.placeId === p.placeId ? {...v, edited: true, categoryKey: e.target.value as CategoryKey} : v))}>{ALL_CATEGORY_KEYS.map(k => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}</select>
        <p>{p.reason}</p>
      </div>)}</div><button className="bg-blue-600 text-white p-2" disabled={busy} onClick={() => run(apply)}>검토한 결과 저장</button>
    </section>}
    <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th>장소</th><th>원본 분류 / 경로</th><th>현재 분류 / 출처 / 근거</th><th>직접 변경</th></tr></thead><tbody>{places.map(p => <tr key={p.placeId} className="border-b"><td className="p-2">{p.name}<br/>{p.address}</td><td>{p.originalCategory.label} ({p.originalCategory.code})<br/>{p.originalCategory.cidPath.join(' > ')}</td><td>{CATEGORY_LABELS[p.categoryKey]} · {p.classification?.source || '과거 데이터'}<br/>{p.classification?.reason}</td><td><select aria-label={`${p.name} 직접 분류`} value={p.categoryKey} disabled={busy} onChange={e => run(() => manual(p, e.target.value as CategoryKey))}>{ALL_CATEGORY_KEYS.map(k => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}</select></td></tr>)}</tbody></table></div>
    {cursor && <button disabled={busy} onClick={() => run(() => load(true))}>더 불러오기</button>}
  </div>;
}
