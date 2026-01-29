import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

/**
 * POST /api/admin/migrate-registrants
 * 모든 장소의 registeredBy를 훈동이 계정 UUID로 설정
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Owner 권한 확인
    const callerDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const callerData = callerDoc.data();

    if (!callerData || callerData.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Owner role required' },
        { status: 403 }
      );
    }

    // 훈동이 계정 UUID (환경변수에서 가져오거나 하드코딩)
    // 실제로는 nickname이 "훈동"인 사용자를 찾아야 합니다
    const usersSnapshot = await adminDb
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
    const placesSnapshot = await adminDb.collection('places').get();

    let updated = 0;
    let skipped = 0;

    // Batch update (Firestore는 한 번에 500개까지 batch 가능)
    const BATCH_SIZE = 500;
    let batch = adminDb.batch();
    let batchCount = 0;

    for (const placeDoc of placesSnapshot.docs) {
      const data = placeDoc.data();

      // 이미 registeredBy가 있고 훈동이 포함되어 있으면 스킵
      if (data.registeredBy && data.registeredBy.includes(hoondongUid)) {
        skipped++;
        continue;
      }

      // registeredBy를 [훈동 UID]로 설정
      batch.update(placeDoc.ref, {
        registeredBy: [hoondongUid],
        updatedAt: new Date(),
      });

      updated++;
      batchCount++;

      // 500개마다 batch commit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = adminDb.batch();
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
