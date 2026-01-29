import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

interface RouteParams {
  params: Promise<{ requestId: string }>;
}

/**
 * PATCH /api/requests/[requestId]
 * 요청 승인/거부 (owner만)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { requestId } = await params;

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

    const body = await request.json();
    const { action } = body; // 'approve' or 'reject'

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action. Use "approve" or "reject"' },
        { status: 400 }
      );
    }

    // 요청 조회
    const requestDoc = await adminDb.collection('requests').doc(requestId).get();
    if (!requestDoc.exists()) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    const requestData = requestDoc.data();

    // 이미 처리된 요청인지 확인
    if (requestData?.status !== 'open') {
      return NextResponse.json(
        { error: 'Request already resolved' },
        { status: 409 }
      );
    }

    // 승인인 경우 실제 작업 수행
    if (action === 'approve') {
      if (requestData.type === 'place_delete') {
        // 장소 삭제 (status를 'deleted'로 변경)
        await adminDb.collection('places').doc(requestData.placeId).update({
          status: 'deleted',
          updatedAt: new Date(),
        });
      } else if (requestData.type === 'place_edit') {
        // 장소 수정 (payload 내용 반영)
        if (requestData.payload) {
          await adminDb.collection('places').doc(requestData.placeId).update({
            ...requestData.payload,
            updatedAt: new Date(),
          });
        }
      }
    }

    // 요청 상태 업데이트
    await adminDb.collection('requests').doc(requestId).update({
      status: action === 'approve' ? 'approved' : 'rejected',
      resolvedAt: new Date(),
      resolvedBy: decodedToken.uid,
    });

    return NextResponse.json({
      success: true,
      action,
      requestId,
    });
  } catch (error) {
    console.error('Failed to process request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
