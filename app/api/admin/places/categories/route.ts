import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/lib/firebase/admin';
import { CategoryKey } from '@/types';
import { CATEGORY_LABELS } from '@/lib/utils/categoryIcon';

// categoryCode → categoryKey 자동 매핑
const CODE_TO_KEY: Record<string, CategoryKey> = {
  CAFE: 'Cafe',
  BAR: 'Beer',
};

// 유효한 categoryKey 목록
const VALID_KEYS = new Set([
  'Korea', 'China', 'Japan', 'West',
  'Asian', 'Snack', 'Meat', 'Sea',
  'Cafe', 'Beer', 'Other',
]);

interface CategoryUpdate {
  placeId: string;
  categoryKey: CategoryKey;
}

/**
 * Admin Places Categories API
 * PATCH /api/admin/places/categories
 *
 * Body:
 * {
 *   updates: [{ placeId: string, categoryKey: CategoryKey }]
 * }
 */
export async function PATCH(request: NextRequest) {
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
    const { updates } = body as { updates: CategoryUpdate[] };

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'Invalid updates data' },
        { status: 400 }
      );
    }

    // 최대 500개까지 한 번에 처리
    if (updates.length > 500) {
      return NextResponse.json(
        { error: 'Too many updates. Maximum 500 at a time.' },
        { status: 400 }
      );
    }

    // Firestore batch 처리
    const result = {
      total: updates.length,
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    const batch = adminDb.batch();

    for (const update of updates) {
      try {
        const placeRef = adminDb.collection('places').doc(update.placeId);

        // 카테고리 라벨 가져오기
        const categoryLabel = CATEGORY_LABELS[update.categoryKey] || '기타';

        batch.update(placeRef, {
          categoryKey: update.categoryKey,
          category: categoryLabel,
          categoryCode: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        result.updated++;
      } catch (error) {
        result.failed++;
        result.errors.push(`${update.placeId}: ${error}`);
      }
    }

    await batch.commit();

    // Admin log 기록
    await adminDb.collection('admin_logs').add({
      action: 'BATCH_UPDATE_CATEGORIES',
      performedBy: decodedToken.uid,
      metadata: {
        total: result.total,
        updated: result.updated,
        failed: result.failed,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Admin categories API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/places/categories
 *
 * Body: { action: 'cleanup' | 'auto-assign' }
 *
 * - cleanup: categoryKey가 유효한 장소에서 categoryCode 필드 삭제
 * - auto-assign: categoryCode가 CAFE/BAR인 장소에 categoryKey를 Cafe/Beer로 설정
 */
export async function POST(request: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { action } = await request.json();

    if (action === 'cleanup') {
      // categoryKey가 유효한 장소에서 categoryCode 필드 삭제
      const snapshot = await adminDb
        .collection('places')
        .where('status', '==', 'active')
        .get();

      let cleaned = 0;
      const batchOps: FirebaseFirestore.WriteBatch[] = [];
      let batch = adminDb.batch();
      let opCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.categoryCode && VALID_KEYS.has(data.categoryKey)) {
          batch.update(doc.ref, {
            categoryCode: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          cleaned++;
          opCount++;
          if (opCount === 500) {
            batchOps.push(batch);
            batch = adminDb.batch();
            opCount = 0;
          }
        }
      }
      if (opCount > 0) batchOps.push(batch);

      for (const b of batchOps) {
        await b.commit();
      }

      await adminDb.collection('admin_logs').add({
        action: 'CLEANUP_CATEGORY_CODE',
        performedBy: decodedToken.uid,
        metadata: { cleaned },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ cleaned });
    }

    if (action === 'auto-assign') {
      // categoryCode가 CAFE/BAR인 장소에 categoryKey 자동 배정
      const snapshot = await adminDb
        .collection('places')
        .where('status', '==', 'active')
        .get();

      let assigned = 0;
      const batchOps: FirebaseFirestore.WriteBatch[] = [];
      let batch = adminDb.batch();
      let opCount = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const mappedKey = data.categoryCode ? CODE_TO_KEY[data.categoryCode] : undefined;
        if (mappedKey && !VALID_KEYS.has(data.categoryKey)) {
          batch.update(doc.ref, {
            categoryKey: mappedKey,
            category: CATEGORY_LABELS[mappedKey],
            categoryCode: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          assigned++;
          opCount++;
          if (opCount === 500) {
            batchOps.push(batch);
            batch = adminDb.batch();
            opCount = 0;
          }
        }
      }
      if (opCount > 0) batchOps.push(batch);

      for (const b of batchOps) {
        await b.commit();
      }

      await adminDb.collection('admin_logs').add({
        action: 'AUTO_ASSIGN_CAFE_BAR',
        performedBy: decodedToken.uid,
        metadata: { assigned },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ assigned });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Admin categories POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
