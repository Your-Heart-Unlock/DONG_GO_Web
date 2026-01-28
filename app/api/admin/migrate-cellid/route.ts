import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/lib/firebase/admin';

const CELL_SIZE = 0.01;

function computeCellId(lat: number, lng: number): string {
  const cellLat = Math.floor(lat / CELL_SIZE);
  const cellLng = Math.floor(lng / CELL_SIZE);
  return `${cellLat}_${cellLng}`;
}

/**
 * 기존 places 문서에 cellId 필드를 일괄 추가하는 1회성 마이그레이션 API
 * POST /api/admin/migrate-cellid
 * owner 권한 필요
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    // 인증 확인
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Owner 권한 확인
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Owner role required' }, { status: 403 });
    }

    // cellId가 없는 places 조회
    const placesSnap = await adminDb.collection('places').get();

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    const BATCH_SIZE = 500;
    let batch = adminDb.batch();
    let batchCount = 0;

    for (const doc of placesSnap.docs) {
      const data = doc.data();

      // 이미 cellId가 있으면 스킵
      if (data.cellId) {
        skipped++;
        continue;
      }

      // lat/lng 없으면 스킵
      if (typeof data.lat !== 'number' || typeof data.lng !== 'number') {
        failed++;
        continue;
      }

      const cellId = computeCellId(data.lat, data.lng);
      batch.update(doc.ref, { cellId });
      updated++;
      batchCount++;

      // 500개마다 커밋
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    // 남은 배치 커밋
    if (batchCount > 0) {
      await batch.commit();
    }

    // 로그 기록
    await adminDb.collection('admin_logs').add({
      action: 'MIGRATE_CELLID',
      performedBy: decodedToken.uid,
      metadata: { total: placesSnap.size, updated, skipped, failed },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      total: placesSnap.size,
      updated,
      skipped,
      failed,
    });
  } catch (error) {
    console.error('Migrate cellId error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
