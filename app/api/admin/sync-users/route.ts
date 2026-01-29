import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

/**
 * POST /api/admin/sync-users
 * Firebase Auth에 존재하지만 Firestore users 컬렉션에 문서가 없는 사용자를 동기화
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

    // Firebase Auth 사용자 전체 목록 가져오기 (1000명 단위 페이지네이션)
    const authUsers: { uid: string; email: string; displayName?: string }[] = [];
    let nextPageToken: string | undefined;

    do {
      const listResult = await adminAuth.listUsers(1000, nextPageToken);
      listResult.users.forEach((userRecord) => {
        authUsers.push({
          uid: userRecord.uid,
          email: userRecord.email || '',
          displayName: userRecord.displayName,
        });
      });
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    // Firestore에 이미 존재하는 사용자 확인
    const existingUids = new Set<string>();
    const usersSnapshot = await adminDb.collection('users').get();
    usersSnapshot.docs.forEach((doc) => {
      existingUids.add(doc.id);
    });

    // 누락된 사용자 찾기
    const missingUsers = authUsers.filter((u) => !existingUids.has(u.uid));

    if (missingUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: '누락된 사용자가 없습니다.',
        totalAuth: authUsers.length,
        totalFirestore: existingUids.size,
        synced: 0,
      });
    }

    // 누락된 사용자 Firestore에 생성 (batch 처리)
    const BATCH_SIZE = 500;
    let batch = adminDb.batch();
    let batchCount = 0;
    let synced = 0;

    for (const user of missingUsers) {
      const userRef = adminDb.collection('users').doc(user.uid);
      batch.set(userRef, {
        email: user.email,
        nickname: '', // 빈 문자열로 생성 → 로그인 시 온보딩 페이지로 이동
        role: 'pending',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      synced++;
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      totalAuth: authUsers.length,
      totalFirestore: existingUids.size,
      synced,
      syncedUsers: missingUsers.map((u) => ({
        uid: u.uid,
        email: u.email,
      })),
    });
  } catch (error) {
    console.error('Sync users error:', error);
    return NextResponse.json(
      { error: 'Sync failed', details: String(error) },
      { status: 500 }
    );
  }
}
