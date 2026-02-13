# Authentication & Roles

## Authentication Flow

1. User clicks "Google 로그인" button
2. Firebase Auth handles Google OAuth popup
3. On success, user document created in `users/{uid}` with role `pending`
4. If no nickname set, `NicknameGate` component redirects to onboarding
5. Owner manually approves user (changes role to `member`)

## Roles

| Role | Access | Description |
|------|--------|-------------|
| `pending` | Read only | New user, awaiting approval |
| `member` | Read + Write | Approved user, can review/wish/upload |
| `owner` | Full access | Admin, can manage users/places/data |

## API Auth Patterns

All protected API routes use `lib/auth/verifyAuth.ts`:

```typescript
// Owner-only endpoint
const auth = await requireOwner(request);
if (!auth.success) return auth.response;
// auth.uid is available

// Member-or-owner endpoint
const auth = await requireMember(request);
if (!auth.success) return auth.response;
// auth.uid, auth.role available
```

## Route Protection (Client)

- `OwnerGuard` component: Wraps admin pages, redirects non-owners
- `NicknameGate` component: Ensures user has set a nickname before accessing app
