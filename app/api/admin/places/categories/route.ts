import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, admin } from '@/lib/firebase/admin';
import { CategoryKey } from '@/types';
import { CATEGORY_LABELS } from '@/lib/utils/categoryIcon';

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
