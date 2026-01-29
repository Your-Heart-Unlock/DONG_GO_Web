import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

/**
 * POST /api/requests
 * 삭제 요청 생성 (member/owner만)
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

    // Member 또는 Owner 권한 확인
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || (userData.role !== 'member' && userData.role !== 'owner')) {
      return NextResponse.json(
        { error: 'Forbidden: Member or Owner role required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, placeId, payload } = body;

    // 필수 필드 검증
    if (!type || !placeId) {
      return NextResponse.json(
        { error: 'Missing required fields: type, placeId' },
        { status: 400 }
      );
    }

    // 지원하는 요청 타입 확인
    if (type !== 'place_delete' && type !== 'place_edit') {
      return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
      );
    }

    // 장소 존재 확인
    const placeDoc = await adminDb.collection('places').doc(placeId).get();
    if (!placeDoc.exists()) {
      return NextResponse.json(
        { error: 'Place not found' },
        { status: 404 }
      );
    }

    // 이미 동일한 요청이 열려있는지 확인
    const existingRequestSnap = await adminDb
      .collection('requests')
      .where('type', '==', type)
      .where('placeId', '==', placeId)
      .where('requestedBy', '==', decodedToken.uid)
      .where('status', '==', 'open')
      .limit(1)
      .get();

    if (!existingRequestSnap.empty) {
      return NextResponse.json(
        { error: 'You already have an open request for this place' },
        { status: 409 }
      );
    }

    // 요청 생성
    const requestDoc = await adminDb.collection('requests').add({
      type,
      placeId,
      requestedBy: decodedToken.uid,
      payload: payload || null,
      status: 'open',
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      requestId: requestDoc.id,
    });
  } catch (error) {
    console.error('Failed to create request:', error);
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/requests
 * 요청 목록 조회 (owner만)
 */
export async function GET(request: NextRequest) {
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
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || userData.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: Owner role required' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // open, approved, rejected
    const type = searchParams.get('type'); // place_delete, place_edit

    // 요청 목록 조회
    let query = adminDb.collection('requests').orderBy('createdAt', 'desc');

    if (status) {
      query = query.where('status', '==', status) as any;
    }

    if (type) {
      query = query.where('type', '==', type) as any;
    }

    const snapshot = await query.get();

    const requests = snapshot.docs.map((doc) => ({
      requestId: doc.id,
      type: doc.data().type,
      placeId: doc.data().placeId,
      requestedBy: doc.data().requestedBy,
      payload: doc.data().payload,
      status: doc.data().status,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      resolvedAt: doc.data().resolvedAt?.toDate(),
      resolvedBy: doc.data().resolvedBy,
    }));

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Failed to fetch requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
