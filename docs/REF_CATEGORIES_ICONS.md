# Categories & Icons (SVG, Tiered)

This document defines the **main categories (12)** and the **tiered SVG icon system** used across the app
(map markers, filters, lists).

Icons are stored with the following filename convention:

```
[CategoryKey]_[Grade].svg
```
Example:
```
Asian_A.svg
```

- **Total files**: 12 categories × 6 grades = **72 SVGs**
- **Grades**: `F`, `C`, `B`, `A`, `S`, `N`

> Assumption: SVG files are located at `public/icons/categories/`.
> If your actual path differs, update the path references below.

---

## Category Keys (Canonical)

These keys are the **only values stored in Firestore** for categories.
UI labels and icons are resolved via mapping.

- `Korea`
- `China`
- `Japan`
- `West`
- `Asian`
- `Snack`
- `Meat`
- `Sea`
- `Cafe`
- `Beer`
- `Other`
- `Idle`

---

## Category Labels (UI)

| Key | Label (ko) |
|----|-----------|
| Korea | 한식 |
| China | 중식 |
| Japan | 일식 |
| West | 양식 |
| Asian | 아시안/동남아 |
| Snack | 분식/간편식 |
| Meat | 고기/구이 |
| Sea | 해산물/횟집 |
| Cafe | 카페/디저트 |
| Beer | 술/바 |
| Other | 기타 |
| Idle | 미분류 |

---

## Icon Grades

Each category has **six visual grades**.

| Grade | Meaning (recommended usage) |
|------|-----------------------------|
| F | Very bad / avoid |
| C | Below average |
| B | Neutral / okay |
| A | Good |
| S | Excellent / highly recommended |
| N | Not rated / no evaluation |

---

## File Naming Examples

```
Korea_F.svg
Korea_C.svg
Korea_B.svg
Korea_A.svg
Korea_S.svg
Korea_N.svg

Asian_A.svg
Beer_S.svg
Cafe_N.svg
Idle_N.svg
```

All filenames must strictly follow:
```
{CategoryKey}_{Grade}.svg
```

Case-sensitive.

---

## Implementation Snippets (Next.js)

### Category + Grade → Icon path

```ts
export type CategoryKey =
  | "Korea" | "China" | "Japan" | "West"
  | "Asian" | "Snack" | "Meat" | "Sea"
  | "Cafe" | "Beer" | "Other" | "Idle";

export type IconGrade = "F" | "C" | "B" | "A" | "S" | "N";

export function getCategoryIconPath(category: CategoryKey, grade: IconGrade = "N") {
  return `/icons/categories/${category}_${grade}.svg`;
}
```

### Render example

```tsx
function CategoryIcon({
  category,
  grade = "N",
  size = 20,
}: {
  category: CategoryKey;
  grade?: IconGrade;
  size?: number;
}) {
  const src = getCategoryIconPath(category, grade);
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={`${category} ${grade}`}
      loading="lazy"
    />
  );
}
```

---

## UI Rules

1. **Main category** is determined only by `CategoryKey`.
2. **Visual intensity** (or preference tier) is expressed via `Grade`.
3. If an icon file is missing, fallback to:
   - `Idle_N.svg`

---

## Checklist

- [ ] 72 SVG files exist under `public/icons/categories/`
- [ ] Filenames match `{CategoryKey}_{Grade}.svg`
- [ ] Firestore uses only the canonical category keys listed above
- [ ] UI resolves label + icon via the mapping
- [ ] Missing icons fallback to `Idle_N.svg`

---

## Change Log

- 2026-01-28: Standardized to tiered icon system (12 categories × 6 grades) using `{CategoryKey}_{Grade}.svg` naming.
