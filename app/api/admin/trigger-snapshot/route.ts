import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/verifyAuth';
import { getCurrentMonthKey } from '@/lib/utils/monthKey';

/**
 * Admin: Manual Snapshot Trigger
 * POST /api/admin/trigger-snapshot
 *
 * Body: { monthKey?: string } (기본값: 현재 월)
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (!auth.success) return auth.response;

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
      triggeredBy: auth.uid,
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
