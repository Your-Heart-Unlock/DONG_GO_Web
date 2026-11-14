import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { requireOwner } from '@/lib/auth/verifyAuth';
import { CATEGORY_LABELS } from '@/lib/utils/categoryIcon';
import { classify, isCategoryKey, isProtectedCategory, needsCategoryReview, originalOf, RULE_VERSION } from '@/lib/admin/classification';

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requireOwner(request);
    if (!actor.success) return actor.response;
    const { updates, source = 'manual' } = await request.json();
    if (!['manual','rule','llm'].includes(source) || !Array.isArray(updates) || !updates.length || updates.length > 200) return NextResponse.json({ error: 'Invalid updates/source (maximum 200)' }, { status: 400 });
    const ids = new Set<string>();
    for (const u of updates) {
      if (!u || typeof u.placeId !== 'string' || !/^[a-zA-Z0-9_-]{1,150}$/.test(u.placeId) || ids.has(u.placeId) || !isCategoryKey(u.categoryKey) || !isCategoryKey(u.expectedCategoryKey) || (source === 'llm' && (typeof u.reason !== 'string' || !u.reason.trim() || u.reason.length > 3000))) return NextResponse.json({ error: 'Invalid/duplicate ID, category, expectedCategoryKey or LLM reason' }, { status: 400 });
      ids.add(u.placeId);
    }
    const db = actor.db;
    // Read and validate everything before any write; concurrent manual changes cause conflict.
    const result = await db.runTransaction(async tx => {
      const refs = updates.map(u => db.collection('places').doc(u.placeId));
      const docs = await tx.getAll(...refs);
      const changes = docs.map((doc, i) => {
        const old = doc.data(); const u = updates[i];
        if (!old) throw new Error(`Missing place: ${u.placeId}`);
        if ((old.categoryKey || 'Idle') !== u.expectedCategoryKey) throw new Error(`Changed since preview: ${u.placeId}`);
        if (source !== 'manual' && isProtectedCategory(old)) throw new Error(`Protected manual category: ${u.placeId}`);
        const proposal = classify(old);
        if (source === 'llm' && (!needsCategoryReview(old) || proposal.categoryKey !== 'Idle')) throw new Error(`Apply rules first; LLM is only for unresolved places: ${u.placeId}`);
        if (source === 'rule' && (!needsCategoryReview(old) || proposal.categoryKey !== u.categoryKey)) throw new Error(`Stale rule proposal: ${u.placeId}`);
        const classification = source === 'rule' ? proposal.classification : { source, reason: source === 'manual' ? '관리자가 직접 선택' : u.reason.trim(), needsReview: u.categoryKey === 'Idle', version: RULE_VERSION };
        return { doc, old, u, classification };
      });
      for (const { doc, old, u, classification } of changes) {
        tx.update(doc.ref, { originalCategory: originalOf(old), categoryKey: u.categoryKey, category: CATEGORY_LABELS[u.categoryKey as keyof typeof CATEGORY_LABELS], classification,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        tx.create(db.collection('admin_logs').doc(), { action: 'CATEGORY_CHANGE', placeId: doc.id, performedBy: actor.uid,
          before: { categoryKey: old.categoryKey || 'Idle', classification: old.classification || null }, after: { categoryKey: u.categoryKey, classification }, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      return { total: updates.length, updated: changes.length, failed: 0, errors: [] };
    });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 409 }); }
}
// Preview only. Old cleanup action cannot delete source codes anymore.
export async function POST(request: NextRequest) {
  try {
    const actor = await requireOwner(request);
    if (!actor.success) return actor.response;
    const { action } = await request.json();
    if (!['preview','auto-assign'].includes(action)) return NextResponse.json({ error: 'Use preview; source-code deletion is disabled' }, { status: 400 });
    const snapshot = await actor.db.collection('places').where('status','==','active').get();
    const proposals = snapshot.docs.filter(d => needsCategoryReview(d.data()) && !isProtectedCategory(d.data())).map(d => {
      const data = d.data(); const proposal = classify(data);
      return { placeId: d.id, name: data.name, address: data.address, expectedCategoryKey: data.categoryKey || 'Idle', ...proposal };
    });
    return NextResponse.json({ proposals, dryRun: true });
  } catch (error) { return NextResponse.json({ error: String(error) }, { status: 500 }); }
}
