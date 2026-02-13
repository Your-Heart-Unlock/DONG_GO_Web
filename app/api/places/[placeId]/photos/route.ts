import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase/admin';
import { requireMember } from '@/lib/auth/verifyAuth';

/**
 * POST /api/places/[placeId]/photos
 * 장소 사진 업로드 (member/owner만)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  try {
    if (!adminStorage) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const auth = await requireMember(req);
    if (!auth.success) return auth.response;
    const db = auth.db;

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

    // 파일 크기 체크 (4MB - Vercel 페이로드 제한 대응)
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds 4MB limit' },
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

    // 파일명 생성 (타임스탬프 + 원본 파일명)
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${timestamp}_${sanitizedFileName}`;

    // Admin SDK로 Storage에 업로드
    const bucket = adminStorage.bucket();
    const fileRef = bucket.file(`places/${placeId}/${fileName}`);
    const buffer = Buffer.from(await file.arrayBuffer());

    await fileRef.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // 파일을 공개 접근 가능하게 설정
    await fileRef.makePublic();

    // 공개 URL 생성
    const url = `https://storage.googleapis.com/${bucket.name}/places/${placeId}/${fileName}`;

    // Admin SDK로 Firestore에 메타데이터 저장
    const photoDoc = await db.collection('photos').add({
      placeId,
      url,
      fileName,
      uploadedBy: auth.uid,
      uploadedAt: new Date(),
    });

    return NextResponse.json({
      photoId: photoDoc.id,
      url,
      uploadedBy: auth.uid,
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

    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin not initialized' },
        { status: 500 }
      );
    }

    const snapshot = await adminDb
      .collection('photos')
      .where('placeId', '==', placeId)
      .get();

    const photos = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        photoId: doc.id,
        url: data.url,
        uploadedBy: data.uploadedBy,
        uploadedAt: data.uploadedAt?.toDate()?.toISOString() || new Date().toISOString(),
      };
    });

    return NextResponse.json({ photos });
  } catch (error) {
    console.error('Failed to fetch photos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}
