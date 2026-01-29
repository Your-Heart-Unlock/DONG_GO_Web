import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { db, storage } from '@/lib/firebase/client';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * POST /api/places/[placeId]/photos
 * 장소 사진 업로드 (member/owner만)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
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

    const { placeId } = await params;

    // FormData에서 파일 추출
    const formData = await req.formData();
    const file = formData.get('photo') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // 파일 크기 체크 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // 이미지 타입 체크
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    if (!storage) {
      return NextResponse.json(
        { error: 'Storage not initialized' },
        { status: 500 }
      );
    }

    // 파일명 생성 (타임스탬프 + 원본 파일명)
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${timestamp}_${sanitizedFileName}`;

    // Storage에 업로드
    const storageRef = ref(storage, `places/${placeId}/${fileName}`);
    const buffer = await file.arrayBuffer();
    const uploadResult = await uploadBytes(storageRef, buffer, {
      contentType: file.type,
    });

    // 다운로드 URL 가져오기
    const url = await getDownloadURL(uploadResult.ref);

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    // Firestore에 메타데이터 저장
    const photosRef = collection(db, 'photos');
    const photoDoc = await addDoc(photosRef, {
      placeId,
      url,
      fileName,
      uploadedBy: decodedToken.uid,
      uploadedAt: serverTimestamp(),
    });

    return NextResponse.json({
      photoId: photoDoc.id,
      url,
      uploadedBy: decodedToken.uid,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/places/[placeId]/photos
 * 장소 사진 목록 조회
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  try {
    const { placeId } = await params;

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    const photosRef = collection(db, 'photos');
    const q = query(photosRef, where('placeId', '==', placeId));
    const snapshot = await getDocs(q);

    const photos = snapshot.docs.map((doc) => ({
      photoId: doc.id,
      url: doc.data().url,
      uploadedBy: doc.data().uploadedBy,
      uploadedAt: doc.data().uploadedAt?.toDate()?.toISOString() || new Date().toISOString(),
    }));

    return NextResponse.json({ photos });
  } catch (error) {
    console.error('Failed to fetch photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}
