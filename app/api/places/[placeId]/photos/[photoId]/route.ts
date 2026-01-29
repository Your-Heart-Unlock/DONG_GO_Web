import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { db, storage } from '@/lib/firebase/client';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

/**
 * DELETE /api/places/[placeId]/photos/[photoId]
 * 사진 삭제 (member/owner만, 본인이 업로드한 사진 또는 owner)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ placeId: string; photoId: string }> }
) {
  try {
    // 인증 확인
    if (!adminAuth || !adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // 권한 확인
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || !['member', 'owner'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Member or Owner role required' },
        { status: 403 }
      );
    }

    const { placeId, photoId } = await params;

    if (!db || !storage) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      );
    }

    // 사진 정보 조회
    const photoRef = doc(db, 'photos', photoId);
    const photoSnap = await getDoc(photoRef);

    if (!photoSnap.exists()) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    const photoData = photoSnap.data();

    // 권한 체크: 본인이 업로드한 사진이거나 owner 역할
    if (photoData.uploadedBy !== decodedToken.uid && userData.role !== 'owner') {
      return NextResponse.json(
        { error: 'Forbidden: You can only delete your own photos' },
        { status: 403 }
      );
    }

    // Storage에서 파일 삭제
    try {
      const storageRef = ref(storage, `places/${placeId}/${photoData.fileName}`);
      await deleteObject(storageRef);
    } catch (storageError) {
      console.error('Storage delete error:', storageError);
      // Storage 삭제 실패해도 메타데이터는 삭제
    }

    // Firestore에서 메타데이터 삭제
    await deleteDoc(photoRef);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Photo delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    );
  }
}
