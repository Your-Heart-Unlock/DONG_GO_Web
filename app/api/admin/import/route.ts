import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { requireOwner } from '@/lib/auth/verifyAuth';
import { ImportRow, ImportDuplicatePolicy } from '@/types';
import { computeCellId } from '@/lib/utils/cellId';
import { inferCategoryKey } from '@/lib/utils/categoryIcon';
import { encodeGeohash } from '@/lib/utils/geohash';

/**
 * Admin Import API
 * POST /api/admin/import
 *
 * Body:
 * {
 *   rows: ImportRow[],
 *   duplicatePolicy: 'SKIP' | 'UPDATE',
 *   ownerUid: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

    // Request body 파싱
    const body = await request.json();
    const { rows, duplicatePolicy, ownerUid } = body as {
      rows: ImportRow[];
      duplicatePolicy: ImportDuplicatePolicy;
      ownerUid: string;
    };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid rows data' },
        { status: 400 }
      );
    }

    // Firestore batch 처리 (최대 500개씩)
    const result = {
      total: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    const BATCH_SIZE = 500;
    const batches = Math.ceil(rows.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const batchRows = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const batch = db.batch();

      for (const row of batchRows) {
        try {
          const placeRef = db.collection('places').doc(row.placeId);
          const existing = await placeRef.get();

          if (existing.exists) {
            if (duplicatePolicy === 'UPDATE') {
              // 업데이트
              batch.update(placeRef, {
                name: row.name,
                address: row.address,
                lat: row.lat,
                lng: row.lng,
                category: row.category,
                categoryCode: row.categoryCode || '',
                categoryKey: inferCategoryKey(row.category),
                cellId: computeCellId(row.lat, row.lng),
                geohash: encodeGeohash(row.lat, row.lng),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              result.updated++;
            } else {
              // SKIP
              result.skipped++;
            }
          } else {
            // 신규 생성
            batch.set(placeRef, {
              placeId: row.placeId,
              name: row.name,
              address: row.address,
              lat: row.lat,
              lng: row.lng,
              category: row.category,
              categoryCode: row.categoryCode || '',
              categoryKey: inferCategoryKey(row.category),
              source: 'naver_import',
              status: 'active',
              mapProvider: 'naver',
              cellId: computeCellId(row.lat, row.lng),
              geohash: encodeGeohash(row.lat, row.lng),
              createdBy: ownerUid,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            result.created++;
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`${row.placeId}: ${error}`);
        }
      }

      await batch.commit();
    }

    // Admin log 기록
    await db.collection('admin_logs').add({
      action: 'IMPORT_PLACES',
      performedBy: ownerUid,
      metadata: {
        total: result.total,
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        duplicatePolicy,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
