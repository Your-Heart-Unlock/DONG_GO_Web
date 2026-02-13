import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/admin';
import { requireOwner } from '@/lib/auth/verifyAuth';

/**
 * POST /api/admin/migrate-registrants
 * createdBy가 없거나 naver_import인 장소의 createdBy를 훈동이 계정 UUID로 설정
 * 기존 registeredBy 배열 필드도 제거
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

    // 훈동이 계정 UUID (환경변수에서 가져오거나 하드코딩)
    // 실제로는 nickname이 "훈동"인 사용자를 찾아야 합니다
    const usersSnapshot = await db
      .collection('users')
      .where('nickname', '==', '훈동')
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json(
        { error: '훈동 계정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const hoondongUid = usersSnapshot.docs[0].id;

    // 모든 장소 가져오기
    const placesSnapshot = await db.collection('places').get();

    let updated = 0;
    let skipped = 0;

    // Batch update (Firestore는 한 번에 500개까지 batch 가능)
    const BATCH_SIZE = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const placeDoc of placesSnapshot.docs) {
      const data = placeDoc.data();

      // createdBy가 없거나 naver_import인 경우 훈동 UID로 설정
      const needsUpdate = !data.createdBy || data.source === 'naver_import';

      if (!needsUpdate) {
        skipped++;
        continue;
      }

      // createdBy를 훈동 UID로 설정, registeredBy 배열 필드 제거
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        createdBy: hoondongUid,
        updatedAt: new Date(),
      };

      // 기존 registeredBy 배열 필드가 있으면 제거
      if (data.registeredBy) {
        updateData.registeredBy = admin.firestore.FieldValue.delete();
      }

      batch.update(placeDoc.ref, updateData);

      updated++;
      batchCount++;

      // 500개마다 batch commit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    // 남은 batch commit
    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      hoondongUid,
      updated,
      skipped,
      total: placesSnapshot.size,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}
