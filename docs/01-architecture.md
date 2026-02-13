# Architecture Overview

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication (Google OAuth)
- **Storage**: Firebase Storage (photo uploads)
- **Map**: Naver Maps API
- **Hosting**: Vercel
- **Cron**: Vercel Cron Jobs

## Project Structure

```
app/
  api/                  # API Routes (Server-side)
    admin/              # Owner-only admin endpoints
    cron/               # Scheduled job endpoints
    me/                 # Current user endpoints
    places/             # Place CRUD & search
    photos/             # Photo management
    requests/           # Delete/edit requests
    wishes/             # Wishlist
    stats/              # Service-wide statistics
    search/             # Place search (Naver/Kakao)
    badges/             # Badge system
    users/              # User profile
  add/                  # Add place page
  admin/                # Admin dashboard page
  leaderboard/          # Hall of Fame page
  stats/                # Statistics page
  place/[placeId]/      # Place detail page
  page.tsx              # Main map page

components/
  FilterPanel.tsx       # Category & tier filter
  SearchBar.tsx         # Place search
  NaverMapView.tsx      # Naver Maps integration
  PlaceBottomSheet.tsx  # Place detail bottom sheet
  ReviewCard.tsx        # Review display card
  ReviewForm.tsx        # Review creation form
  ReviewList.tsx        # Review list with pagination
  PhotoGallery.tsx      # Photo gallery
  HallOfFamePreview.tsx # Leaderboard preview
  guards/
    OwnerGuard.tsx      # Owner-only route protection
    NicknameGate.tsx    # Nickname setup enforcement

lib/
  auth/
    verifyAuth.ts       # Server-side auth utilities (verifyAuth, requireOwner, requireMember)
  firebase/
    admin.ts            # Firebase Admin SDK initialization
    client.ts           # Client-side Firebase config
    auth.ts             # Auth helper functions
    user.ts             # User CRUD operations
    places.ts           # Place queries (client-side)
    reviews.ts          # Review management
    badges.ts           # Badge check & award logic
    transformers.ts     # Firestore document transformers
  utils/
    tierCalculation.ts  # Shared tier weight/average calculation
    categoryIcon.ts     # Category labels & icon mapping
    cellId.ts           # S2 geometry cell ID computation
    geohash.ts          # Geohash encoding for proximity search
    monthKey.ts         # Month key utilities (YYYY-MM format)
    recordPoints.ts     # Record point calculation logic
  naver/
    useNaverMaps.ts     # Naver Maps React hook
  admin/
    importParser.ts     # CSV/data import parser

types/
  index.ts              # All TypeScript type definitions
```

## Auth Architecture

All API routes use centralized auth verification from `lib/auth/verifyAuth.ts`:

- `verifyAuth(request)` - Extracts Bearer token, verifies via Firebase Admin, returns uid + role
- `requireOwner(request)` - Requires `owner` role
- `requireMember(request)` - Requires `member` or `owner` role

Each returns a discriminated union:
```ts
type AuthResult =
  | { success: true; uid: string; role: string }
  | { success: false; response: NextResponse };
```

## Data Flow

1. **Client** authenticates via Firebase Auth (Google OAuth)
2. **Client** sends requests to API routes with `Authorization: Bearer <token>`
3. **API routes** verify token via Firebase Admin SDK
4. **API routes** read/write Firestore using Admin SDK
5. **Client-side** reads (places, reviews) use Firestore client SDK directly for real-time updates
