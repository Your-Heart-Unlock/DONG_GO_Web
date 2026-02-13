import { NextRequest, NextResponse } from 'next/server';
import { requireMember, requireOwner } from '@/lib/auth/verifyAuth';

/**
 * POST /api/requests
 * 삭제 요청 생성 (member/owner만)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireMember(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

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
    const placeDoc = await db.collection('places').doc(placeId).get();
    if (!placeDoc.exists) {
      return NextResponse.json(
        { error: 'Place not found' },
        { status: 404 }
      );
    }

    // 이미 동일한 요청이 열려있는지 확인
    const existingRequestSnap = await db
      .collection('requests')
      .where('type', '==', type)
      .where('placeId', '==', placeId)
      .where('requestedBy', '==', auth.uid)
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
    const requestDoc = await db.collection('requests').add({
      type,
      placeId,
      requestedBy: auth.uid,
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
    const auth = await requireOwner(request);
    if (!auth.success) return auth.response;
    const db = auth.db;

    // 쿼리 파라미터
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // open, approved, rejected
    const type = searchParams.get('type'); // place_delete, place_edit

    // 요청 목록 조회
    let query: FirebaseFirestore.Query = db.collection('requests');

    if (status) {
      query = query.where('status', '==', status);
    }

    if (type) {
      query = query.where('type', '==', type);
    }

    const snapshot = await query.get();

    // 요청 목록에 장소 이름과 요청자 닉네임 추가
    const requests = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        // 장소 이름 조회
        let placeName = '알 수 없음';
        try {
          const placeDoc = await db.collection('places').doc(data.placeId).get();
          if (placeDoc.exists) {
            placeName = placeDoc.data()?.name || '알 수 없음';
          }
        } catch {}

        // 요청자 닉네임 조회
        let requesterNickname = '알 수 없음';
        try {
          const userDoc = await db.collection('users').doc(data.requestedBy).get();
          if (userDoc.exists) {
            requesterNickname = userDoc.data()?.nickname || '알 수 없음';
          }
        } catch {}

        return {
          requestId: doc.id,
          type: data.type,
          placeId: data.placeId,
          placeName,
          requestedBy: data.requestedBy,
          requesterNickname,
          payload: data.payload,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          resolvedAt: data.resolvedAt?.toDate(),
          resolvedBy: data.resolvedBy,
        };
      })
    );

    // 생성일 기준 내림차순 정렬 (최신순)
    requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Failed to fetch requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}
