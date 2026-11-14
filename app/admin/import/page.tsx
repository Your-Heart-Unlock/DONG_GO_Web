'use client';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { parseImportJSON } from '@/lib/admin/importParser';
import { RULE_VERSION } from '@/lib/admin/classification';
import { ALL_CATEGORY_KEYS, CATEGORY_LABELS } from '@/lib/utils/categoryIcon';
import { CategoryKey, ImportPreviewRow, ImportResult } from '@/types';

type Preview = ImportPreviewRow & { targetId?: string; matchKind?: string; preserveCategory?: boolean; existingCategoryKey?: CategoryKey };
export default function AdminImportPage() {
  const { firebaseUser } = useAuth();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview[]>([]);
  const [policy, setPolicy] = useState('SKIP');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [reviewOnly, setReviewOnly] = useState(false);
  async function call(body: object) {
    if (!firebaseUser) throw new Error('로그인이 필요합니다.');
    const response = await fetch('/api/admin/import', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await firebaseUser.getIdToken()}` }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '가져오기 실패');
    return data;
  }
  async function parse() {
    setBusy(true); setError(''); setResult(null); setPreview([]);
    try { const rows = parseImportJSON(text); setPreview((await call({ rows, dryRun: true, duplicatePolicy: policy })).preview); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function commit() {
    const rows = preview.filter(p => p.status === 'OK' || (p.status === 'DUPLICATE' && p.matchKind === 'exact' && policy === 'UPDATE')).map(p => p.row);
    if (!rows.length || !confirm(`${rows.length}개 장소를 저장합니다. 미분류 항목은 Idle로 저장됩니다. 계속할까요?`)) return;
    setBusy(true); setError('');
    try { setResult(await call({ rows, duplicatePolicy: policy })); setPreview([]); }
    catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  const count = preview.filter(p => p.row.classification?.needsReview).length;
  const eligible = preview.filter(p => p.status === 'OK' || (p.status === 'DUPLICATE' && p.matchKind === 'exact' && policy === 'UPDATE')).length;
  return <div className="space-y-4">
    <h1 className="text-2xl font-bold">네이버 장소 가져오기</h1>
    <p>원본 분류·메모를 보존합니다. 기존 수동 분류와 리뷰·사진·등록자는 유지됩니다.</p>
    <input aria-label="JSON 파일 업로드" type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return;
      try { if(file.size > 20 * 1024 * 1024) throw new Error('20MB 이하 파일을 선택하세요.'); setText(await file.text()); setPreview([]); setResult(null); setError(''); } catch(e) { setError(String(e)); }
    }} />
    <textarea aria-label="원본 JSON" className="w-full h-40 border p-2" value={text} disabled={busy} onChange={e => { setText(e.target.value); setPreview([]); }} />
    <select aria-label="중복 정책" className="border p-2" value={policy} disabled={busy} onChange={e => setPolicy(e.target.value)}>
      <option value="SKIP">기존 장소 건너뛰기 (기본)</option><option value="UPDATE">기존 장소 업데이트 (수동 분류 보존)</option>
    </select>
    <button className="bg-blue-600 text-white p-2 rounded" disabled={busy || !text.trim()} onClick={parse}>미리보기 생성</button>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    {!!preview.length && <>
      <p>전체 {preview.length} · 신규 {preview.filter(p => p.status === 'OK').length} · 중복/후보 {preview.filter(p => p.status === 'DUPLICATE').length} · 오류 {preview.filter(p => p.status === 'INVALID').length} · 분류 검토 {count} · 저장 대상 {eligible}</p>
      <p>{ALL_CATEGORY_KEYS.map(k => `${CATEGORY_LABELS[k]} ${preview.filter(p => ((p.preserveCategory || (policy === 'SKIP' && p.status === 'DUPLICATE')) ? p.existingCategoryKey : p.row.categoryKey) === k).length}`).join(' / ')}</p>
      <label><input type="checkbox" checked={reviewOnly} onChange={e => setReviewOnly(e.target.checked)} /> 분류 검토 대상만 표시</label>
      <div className="max-h-[600px] overflow-auto"><table className="w-full text-sm"><thead><tr><th>장소 / 주소</th><th>원본 분류</th><th>저장할 분류</th><th>근거 / 검토</th><th>중복 / 오류</th></tr></thead>
        <tbody>{preview.map((p,i) => (!reviewOnly || p.row.classification?.needsReview) && <tr key={i} className="border-b align-top">
          <td className="p-2">{p.row.name}<br/>{p.row.address}<br/>{p.row.placeId}</td>
          <td>{p.row.originalCategory?.label} ({p.row.originalCategory?.code})<br/>{p.row.originalCategory?.cidPath.join(' > ')}</td>
          <td><select aria-label={`${p.row.name} 분류`} value={(p.preserveCategory || (policy === 'SKIP' && p.status === 'DUPLICATE')) ? p.existingCategoryKey : p.row.categoryKey} disabled={busy || p.status === 'INVALID' || (policy === 'SKIP' && p.status === 'DUPLICATE') || p.preserveCategory || p.matchKind === 'possible'} onChange={e => {
            const key = e.target.value as CategoryKey;
            setPreview(prev => prev.map((v,j) => j === i ? { ...v, row: { ...v.row, categoryKey: key, classification: { source: 'manual', reason: '미리보기에서 직접 선택', needsReview: key === 'Idle', version: RULE_VERSION } } } : v));
          }}>{ALL_CATEGORY_KEYS.map(k => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}</select></td>
          <td className="p-2 max-w-sm">{p.preserveCategory ? '기존 수동 분류 보존' : `${p.row.classification?.source}: ${p.row.classification?.reason}`}<br/>{p.row.classification?.needsReview && '검토 필요'}</td>
          <td>{p.status}<br/>{p.reason}<br/>{p.targetId}</td>
        </tr>)}</tbody></table></div>
      <button className="bg-blue-600 text-white p-3 rounded" disabled={busy || !eligible} onClick={commit}>{busy ? '처리 중…' : `${eligible}개 저장`}</button>
    </>}
  </div>;
}
