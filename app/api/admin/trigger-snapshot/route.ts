import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { getCurrentMonthKey, getPreviousMonthKey } from '@/lib/utils/monthKey';

/**
 * Admin: Manual Snapshot Trigger
 * POST /api/admin/trigger-snapshot
 *
 * Body: { monthKey?: string } (기본값: 현재 월)
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // Body에서 monthKey 가져오기
    let body: { monthKey?: string } = {};
    try {
      body = await request.json();
    } catch {
      // body 없음
    }

    const targetMonthKey = body.monthKey || getCurrentMonthKey();

    // Cron API 직접 호출 (CRON_SECRET 우회)
    const cronUrl = new URL('/api/cron/monthly-snapshot', request.url);
    const cronResponse = await fetch(cronUrl.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET || 'manual-trigger'}`,
      },
    });

    if (!cronResponse.ok) {
      const errorData = await cronResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: 'Snapshot failed', details: errorData },
        { status: 500 }
      );
    }

    const result = await cronResponse.json();

    return NextResponse.json({
      success: true,
      triggeredBy: decodedToken.uid,
      monthKey: targetMonthKey,
      result,
    });
  } catch (error) {
    console.error('Manual snapshot trigger error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
