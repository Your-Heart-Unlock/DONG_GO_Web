import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/lib/firebase/admin';
import { ImportRow, ImportDuplicatePolicy } from '@/types';
import { computeCellId } from '@/lib/utils/cellId';

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
    // Firebase Admin 초기화 확인
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Owner 권한 확인
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Owner role required' },
        { status: 403 }
      );
    }

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
      const batch = adminDb.batch();

      for (const row of batchRows) {
        try {
          const placeRef = adminDb.collection('places').doc(row.placeId);
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
                cellId: computeCellId(row.lat, row.lng),
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
              source: 'naver_import',
              status: 'active',
              mapProvider: 'naver',
              cellId: computeCellId(row.lat, row.lng),
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
    await adminDb.collection('admin_logs').add({
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
