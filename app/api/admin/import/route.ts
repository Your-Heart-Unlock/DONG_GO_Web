import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { requireOwner } from '@/lib/auth/verifyAuth';
import { ImportRow } from '@/types';
import { computeCellId } from '@/lib/utils/cellId';
import { CATEGORY_LABELS } from '@/lib/utils/categoryIcon';
import { encodeGeohash } from '@/lib/utils/geohash';
import { planImport, ExistingImportPlace } from '@/lib/admin/importPlan';
import { isProtectedCategory } from '@/lib/admin/classification';

export async function POST(request: NextRequest) {
  try {
    const actor = await requireOwner(request);
    if (!actor.success) return actor.response;
    const adminDb = actor.db;
    const { rows, duplicatePolicy = 'SKIP', dryRun = false } = await request.json();
    if (!Array.isArray(rows) || !rows.length || rows.length > 2000 || !['SKIP', 'UPDATE'].includes(duplicatePolicy) || typeof dryRun !== 'boolean') return NextResponse.json({ error: 'Invalid rows/policy (maximum 2000)' }, { status: 400 });
    // Includes legacy records without geohash/provider and aliases. No document is replaced or re-keyed.
    const snapshot = await adminDb.collection('places').get();
    const existing = snapshot.docs.map(doc => ({ ...doc.data(), placeId: doc.id })) as ExistingImportPlace[];
    const preview = planImport(rows as ImportRow[], existing);
    if (dryRun) return NextResponse.json({ preview });
    if (preview.some(p => p.status === 'INVALID')) return NextResponse.json({ error: 'Invalid rows', preview }, { status: 400 });
    const result = { total: rows.length, created: 0, updated: 0, skipped: 0, failed: 0, errors: [] as string[] };
    for (const item of preview) {
      if (item.status === 'INVALID') continue;
      if (item.status === 'DUPLICATE' && (duplicatePolicy === 'SKIP' || item.matchKind === 'possible')) { result.skipped++; continue; }
      const row = item.row;
      const ref = adminDb.collection('places').doc(item.status === 'DUPLICATE' ? item.targetId : row.placeId);
      try {
        const outcome = await adminDb.runTransaction(async transaction => {
          const current = await transaction.get(ref);
          const data = current.data();
          if (current.exists && (duplicatePolicy === 'SKIP' || (data?.mapProvider === 'kakao' && data?.naverPlaceId !== row.placeId))) return 'skipped';
          const fields = {
            name: row.name, address: row.address, lat: row.lat, lng: row.lng,
            originalCategory: row.originalCategory!, categoryCode: row.originalCategory!.code,
            naverPlaceId: row.placeId, importMemo: row.memo || '',
            cellId: computeCellId(row.lat, row.lng), geohash: encodeGeohash(row.lat, row.lng),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          const categoryFields = { category: CATEGORY_LABELS[row.categoryKey!], categoryKey: row.categoryKey!, classification: row.classification! };
          if (current.exists) {
            transaction.update(ref, { ...fields, ...(isProtectedCategory(data!) ? {} : categoryFields) });
            return 'updated';
          }
          transaction.create(ref, { ...fields, ...categoryFields, placeId: ref.id, source: 'naver_import', status: 'active', mapProvider: 'naver', createdBy: actor.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
          return 'created';
        });
        result[outcome]++;
      } catch (error) { result.failed++; result.errors.push(`${row.placeId}: ${String(error)}`); }
    }
    await adminDb.collection('admin_logs').add({ action: 'IMPORT_PLACES', performedBy: actor.uid, metadata: { ...result, duplicatePolicy }, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json({ error: 'Import failed' }, { status: 500 });
  }
}
