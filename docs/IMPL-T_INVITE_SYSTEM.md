# IMPL-T: 초대 시스템 (Invite System)

## 개요
Clubhouse 스타일의 초대 코드 시스템을 구현합니다. 폐쇄형 커뮤니티 특성상 owner가 생성한 초대 코드를 통해서만 신규 회원이 가입할 수 있도록 제한합니다.

**예상 소요 시간**: 1.5d  
**우선순위**: P6 (선택 기능)  
**의존성**: C섹션(인증/온보딩), J섹션(Admin Console)

## 데이터 모델

### Firestore Collections

#### `invites/{inviteId}`
```typescript
interface Invite {
  inviteId: string;           // 문서 ID (랜덤 생성, 8자리 코드)
  code: string;               // 사용자에게 보여지는 코드 (예: "DONG2024")
  createdBy: string;          // owner uid
  createdAt: Timestamp;
  expiresAt: Timestamp | null;  // 만료 시간 (null이면 무제한)
  
  maxUses: number;            // 최대 사용 횟수 (0=무제한)
  usedCount: number;          // 현재 사용 횟수
  usedBy: string[];           // 사용한 유저 uid 배열
  
  isActive: boolean;          // 활성화 상태
  note?: string;              // 관리자 메모 (예: "학교 친구들용")
}
```

**인덱스**:
- `code` (unique, 빠른 검증)
- `createdBy, createdAt DESC` (관리자별 코드 조회)
- `isActive, expiresAt` (유효한 코드 필터링)

## API Routes

### POST `/api/admin/invites`
**권한**: owner only

```typescript
// app/api/admin/invites/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { checkOwnerRole } from '@/lib/firebase/user';

interface CreateInviteRequest {
  code?: string;           // 커스텀 코드 (선택)
  maxUses?: number;        // 기본값: 1
  expiresInDays?: number;  // 기본값: 30
  note?: string;
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const isOwner = await checkOwnerRole(decoded.uid);
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { code, maxUses = 1, expiresInDays = 30, note } = await req.json();

    // 코드 생성 (커스텀 또는 랜덤)
    const inviteCode = code || generateRandomCode();
    
    // 중복 체크
    const existing = await adminDb
      .collection('invites')
      .where('code', '==', inviteCode)
      .limit(1)
      .get();
    
    if (!existing.empty) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    }

    const inviteId = adminDb.collection('invites').doc().id;
    const now = new Date();
    const expiresAt = expiresInDays > 0 
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const invite: Invite = {
      inviteId,
      code: inviteCode,
      createdBy: decoded.uid,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: expiresAt ? admin.firestore.Timestamp.fromDate(expiresAt) : null,
      maxUses,
      usedCount: 0,
      usedBy: [],
      isActive: true,
      note: note || ''
    };

    await adminDb.collection('invites').doc(inviteId).set(invite);

    return NextResponse.json({ inviteId, code: inviteCode });
  } catch (error) {
    console.error('Create invite error:', error);
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}

function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자 제거 (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET(req: NextRequest) {
  // owner가 생성한 초대 코드 목록
  try {
    const token = req.headers.get('authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const isOwner = await checkOwnerRole(decoded.uid);
    if (!isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invites = await adminDb
      .collection('invites')
      .where('createdBy', '==', decoded.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const data = invites.docs.map(doc => doc.data());
    return NextResponse.json({ invites: data });
  } catch (error) {
    console.error('Get invites error:', error);
    return NextResponse.json({ error: 'Failed to get invites' }, { status: 500 });
  }
}
```

### GET `/api/invites/[code]/validate`
**권한**: public (로그인 전 검증)

```typescript
// app/api/invites/[code]/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params;

    const snapshot = await adminDb
      .collection('invites')
      .where('code', '==', code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'code_not_found' 
      });
    }

    const invite = snapshot.docs[0].data() as Invite;

    // 만료 체크
    if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'expired' 
      });
    }

    // 사용 횟수 체크
    if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
      return NextResponse.json({ 
        valid: false, 
        reason: 'max_uses_reached' 
      });
    }

    return NextResponse.json({ 
      valid: true,
      inviteId: invite.inviteId,
      note: invite.note 
    });
  } catch (error) {
    console.error('Validate invite error:', error);
    return NextResponse.json({ error: 'Failed to validate invite' }, { status: 500 });
  }
}
```

### POST `/api/invites/[code]/use`
**권한**: authenticated (pending user)

```typescript
// app/api/invites/[code]/use/route.ts
export async function POST(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const token = req.headers.get('authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const { code } = params;

    // 초대 코드 조회 및 검증
    const snapshot = await adminDb
      .collection('invites')
      .where('code', '==', code.toUpperCase())
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 404 });
    }

    const inviteDoc = snapshot.docs[0];
    const invite = inviteDoc.data() as Invite;

    // 유효성 재검증
    if (invite.expiresAt && invite.expiresAt.toDate() < new Date()) {
      return NextResponse.json({ error: 'Code expired' }, { status: 400 });
    }
    if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
      return NextResponse.json({ error: 'Max uses reached' }, { status: 400 });
    }
    if (invite.usedBy.includes(decoded.uid)) {
      return NextResponse.json({ error: 'Already used by you' }, { status: 400 });
    }

    // 트랜잭션: 초대 코드 사용 + 유저 role 변경
    await adminDb.runTransaction(async (transaction) => {
      // 1. 초대 코드 업데이트
      transaction.update(inviteDoc.ref, {
        usedCount: admin.firestore.FieldValue.increment(1),
        usedBy: admin.firestore.FieldValue.arrayUnion(decoded.uid)
      });

      // 2. 유저 role 변경 (pending → member)
      const userRef = adminDb.collection('users').doc(decoded.uid);
      transaction.update(userRef, {
        role: 'member',
        invitedBy: invite.createdBy,
        invitedAt: admin.firestore.Timestamp.now()
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Use invite error:', error);
    return NextResponse.json({ error: 'Failed to use invite' }, { status: 500 });
  }
}
```

## UI Components

### InviteCodeInput (회원가입 플로우)

```typescript
// components/auth/InviteCodeInput.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InviteCodeInput() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      // 1. 검증
      const validateRes = await fetch(`/api/invites/${code}/validate`);
      const validateData = await validateRes.json();

      if (!validateData.valid) {
        const messages = {
          code_not_found: '존재하지 않는 초대 코드입니다.',
          expired: '만료된 초대 코드입니다.',
          max_uses_reached: '사용 횟수가 초과된 코드입니다.'
        };
        setError(messages[validateData.reason] || '유효하지 않은 코드입니다.');
        setLoading(false);
        return;
      }

      // 2. 사용
      const token = await auth.currentUser?.getIdToken();
      const useRes = await fetch(`/api/invites/${code}/use`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!useRes.ok) {
        const errorData = await useRes.json();
        setError(errorData.error || '초대 코드 사용에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 3. 성공 → 홈으로 이동
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('오류가 발생했습니다.');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2">초대 코드 입력</h2>
      <p className="text-gray-600 mb-6">
        동고(DONG-GO)는 초대를 받은 분만 이용할 수 있습니다.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            초대 코드
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: DONG2024"
            className="w-full px-4 py-3 border rounded-lg text-center text-2xl tracking-widest font-mono"
            maxLength={8}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '확인 중...' : '코드 사용하기'}
        </button>
      </form>

      <div className="mt-6 text-sm text-gray-500">
        <p>💡 초대 코드가 없으신가요?</p>
        <p>서비스 관리자에게 문의해주세요.</p>
      </div>
    </div>
  );
}
```

### AdminInvitePage

```typescript
// app/admin/invites/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface Invite {
  inviteId: string;
  code: string;
  createdAt: any;
  expiresAt: any;
  maxUses: number;
  usedCount: number;
  usedBy: string[];
  isActive: boolean;
  note: string;
}

export default function AdminInvitesPage() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [note, setNote] = useState('');

  useEffect(() => {
    loadInvites();
  }, []);

  async function loadInvites() {
    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/invites', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setInvites(data.invites || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createInvite() {
    if (creating) return;
    setCreating(true);

    try {
      const token = await user?.getIdToken();
      const res = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          code: customCode || undefined,
          maxUses,
          expiresInDays,
          note
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`초대 코드가 생성되었습니다: ${data.code}`);
        setCustomCode('');
        setNote('');
        loadInvites();
      } else {
        const error = await res.json();
        alert(error.error || '생성 실패');
      }
    } catch (err) {
      console.error(err);
      alert('오류 발생');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="p-8">로딩 중...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">초대 코드 관리</h1>

      {/* 생성 폼 */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">새 초대 코드 생성</h2>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              커스텀 코드 (선택, 비워두면 자동 생성)
            </label>
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
              placeholder="예: FRIENDS24"
              className="w-full px-3 py-2 border rounded"
              maxLength={10}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              최대 사용 횟수
            </label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded"
              min={1}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              만료 기간 (일)
            </label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded"
              min={1}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              메모
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 대학 친구들용"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        <button
          onClick={createInvite}
          disabled={creating}
          className="w-full bg-purple-600 text-white py-2 rounded font-semibold hover:bg-purple-700 disabled:opacity-50"
        >
          {creating ? '생성 중...' : '코드 생성'}
        </button>
      </div>

      {/* 코드 목록 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">생성된 초대 코드</h2>
        
        {invites.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            생성된 초대 코드가 없습니다.
          </div>
        ) : (
          invites.map((invite) => (
            <div key={invite.inviteId} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-2xl font-bold text-purple-600">
                  {invite.code}
                </div>
                <div className={`px-3 py-1 rounded text-sm ${
                  invite.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {invite.isActive ? '활성' : '비활성'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">사용:</span>{' '}
                  <span className="font-semibold">
                    {invite.usedCount} / {invite.maxUses > 0 ? invite.maxUses : '무제한'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">만료:</span>{' '}
                  <span className="font-semibold">
                    {invite.expiresAt 
                      ? new Date(invite.expiresAt.seconds * 1000).toLocaleDateString()
                      : '무제한'
                    }
                  </span>
                </div>
              </div>

              {invite.note && (
                <div className="mt-2 text-sm text-gray-600">
                  📝 {invite.note}
                </div>
              )}

              {invite.usedBy.length > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  👥 {invite.usedBy.length}명이 사용
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

## 회원가입 플로우 수정

### `/login` 페이지 수정

```typescript
// app/login/page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithGoogle } from '@/lib/firebase/auth';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite'); // 초대 코드 URL 파라미터

  async function handleGoogleLogin() {
    try {
      const user = await signInWithGoogle();
      
      // 초대 코드가 있으면 onboarding으로 전달
      if (inviteCode) {
        router.push(`/onboarding/nickname?invite=${inviteCode}`);
      } else {
        router.push('/onboarding/nickname');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('로그인 실패');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">동고 (DONG-GO)</h1>
      
      {inviteCode && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-purple-800">
            🎉 초대 코드: <span className="font-mono font-bold">{inviteCode}</span>
          </p>
        </div>
      )}

      <button
        onClick={handleGoogleLogin}
        className="flex items-center gap-3 bg-white border px-6 py-3 rounded-lg font-semibold hover:bg-gray-50"
      >
        <img src="/google-icon.svg" alt="Google" className="w-6 h-6" />
        Google로 시작하기
      </button>
    </div>
  );
}
```

### `/onboarding/nickname` 페이지 수정

```typescript
// app/onboarding/nickname/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import InviteCodeInput from '@/components/auth/InviteCodeInput';

export default function NicknamePage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteFromUrl = searchParams.get('invite');

  const [nickname, setNickname] = useState('');
  const [needsInvite, setNeedsInvite] = useState(false);

  // 닉네임 저장 후 초대 코드 입력 필요 여부 판단
  async function handleSaveNickname() {
    // ... 기존 닉네임 저장 로직 ...

    // 초대 코드가 URL에 있으면 자동 사용 시도
    if (inviteFromUrl) {
      try {
        const token = await user?.getIdToken();
        const res = await fetch(`/api/invites/${inviteFromUrl}/use`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          router.push('/');
          return;
        }
      } catch (err) {
        console.error(err);
      }
    }

    // 초대 코드 없으면 입력 화면으로
    setNeedsInvite(true);
  }

  if (needsInvite) {
    return <InviteCodeInput />;
  }

  return (
    // 기존 닉네임 입력 UI
    <div>...</div>
  );
}
```

## 체크리스트

### 백엔드 (0.5d)
- [ ] `invites` 컬렉션 설계 및 인덱스 생성
- [ ] POST `/api/admin/invites` - 초대 코드 생성
- [ ] GET `/api/admin/invites` - 코드 목록 조회
- [ ] GET `/api/invites/[code]/validate` - 코드 검증
- [ ] POST `/api/invites/[code]/use` - 코드 사용 (트랜잭션)
- [ ] generateRandomCode() 헬퍼 함수

### 프론트엔드 (0.7d)
- [ ] InviteCodeInput 컴포넌트
- [ ] `/admin/invites` 관리 페이지
  - [ ] 코드 생성 폼
  - [ ] 코드 목록 테이블
  - [ ] 사용 내역 표시
- [ ] `/login` 페이지 수정 (invite 쿼리 파라미터 지원)
- [ ] `/onboarding/nickname` 페이지 수정 (초대 코드 플로우)

### 테스트 (0.3d)
- [ ] owner가 초대 코드 생성
- [ ] 랜덤 코드 자동 생성 테스트
- [ ] 커스텀 코드 중복 체크
- [ ] 만료된 코드 사용 시도 (실패)
- [ ] 최대 사용 횟수 초과 시도 (실패)
- [ ] 유효한 코드로 회원가입 (pending → member 자동 승급)
- [ ] 동일 유저가 같은 코드 재사용 시도 (실패)

## 테스트 시나리오

### 1. 정상 플로우
```
1. Owner가 /admin/invites에서 코드 생성 (FRIENDS24, 최대 3회)
2. 신규 유저가 /login?invite=FRIENDS24 접속
3. Google 로그인
4. 닉네임 입력
5. 자동으로 초대 코드 FRIENDS24 사용
6. role이 pending → member로 변경
7. 홈 화면으로 이동 (리뷰 작성 가능)
```

### 2. 만료된 코드
```
1. Owner가 1일 만료 코드 생성
2. 2일 후 사용 시도
3. "만료된 초대 코드입니다" 에러
```

### 3. 최대 사용 횟수 초과
```
1. Owner가 최대 1회 사용 코드 생성
2. User A가 사용 (성공)
3. User B가 동일 코드 사용 시도
4. "사용 횟수가 초과된 코드입니다" 에러
```

### 4. 커스텀 코드 중복
```
1. Owner가 DONG2024 코드 생성
2. 다시 DONG2024 생성 시도
3. "이미 존재하는 코드입니다" 에러
```

## 보안 고려사항

1. **코드 추측 방지**: 8자리 랜덤 + 혼동 문자 제외 (I/O/0/1)
2. **중복 사용 방지**: usedBy 배열로 추적
3. **브루트 포스 방지**: rate limiting (추후 추가)
4. **Owner만 생성**: checkOwnerRole() 검증
5. **트랜잭션 사용**: 코드 사용 + role 변경 원자성 보장

## 추후 개선 아이디어

1. **코드 비활성화**: 관리자가 코드 취소
2. **사용 알림**: owner에게 누가 코드를 사용했는지 알림
3. **초대 보상**: 초대한 사람에게 포인트 지급
4. **그룹 코드**: 특정 그룹 태그 자동 부여
5. **QR 코드**: 초대 코드를 QR로 변환
