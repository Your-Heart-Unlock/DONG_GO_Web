import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/verifyAuth';
import { classify, needsCategoryReview, originalOf } from '@/lib/admin/classification';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireOwner(request);
    if (!actor.success) return actor.response;
    const adminDb = actor.db;
    const filter = request.nextUrl.searchParams.get('filter') || 'all';
    const size = Number(request.nextUrl.searchParams.get('limit') || 50);
    if (!Number.isInteger(size) || size < 1 || size > 100 || !['all','idle','uncategorized'].includes(filter)) return NextResponse.json({ error: 'Invalid filter/limit' }, { status: 400 });
    // One predicate for both results and count, including missing legacy categoryKey.
    // Intentionally no index migration required. See docs for scaling limitation.
    const snapshot = await adminDb.collection('places').where('status', '==', 'active').get();
    const filtered = snapshot.docs.filter(doc => filter === 'all' || needsCategoryReview(doc.data()));
    filtered.sort((a,b) => (b.data().createdAt?.toMillis?.() || 0) - (a.data().createdAt?.toMillis?.() || 0) || a.id.localeCompare(b.id));
    const cursor = request.nextUrl.searchParams.get('cursor');
    const position = cursor ? filtered.findIndex(doc => doc.id === cursor) : -1;
    if (cursor && position < 0) return NextResponse.json({ error: 'Cursor changed. Reload list.' }, { status: 400 });
    const page = filtered.slice(position + 1, position + 1 + size);
    return NextResponse.json({ places: page.map(doc => {
      const data = doc.data();
      return { placeId: doc.id, name: data.name, address: data.address, category: data.category || '', categoryKey: data.categoryKey || 'Idle',
        categoryCode: data.categoryCode || '', originalCategory: originalOf(data), classification: data.classification || null,
        proposal: classify(data), source: data.source, mapProvider: data.mapProvider || null };
    }), pagination: { total: filtered.length, limit: size, hasMore: position + 1 + size < filtered.length, nextCursor: page.at(-1)?.id || null } });
  } catch (error) { console.error(error); return NextResponse.json({ error: 'Failed to load places' }, { status: 500 }); }
}
