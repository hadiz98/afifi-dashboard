# Frontend integration changes (backend)

This file aggregates **all API/contract changes** made during this work so the frontend can implement updates in one pass.

All routes are under the global prefix **`/api`**.

---

## 1) Horses — shared vs translated fields + pedigree

### Data shape changes
- `color` and `breeder` moved from the root horse object to **each translation** (`translations[].color`, `translations[].breeder`).
- Added structured **`pedigree`** on the root horse object (not localized):
  - keys: `father`, `mother`, `grandfather`, `grandmother`
  - each: `{ name?: string|null, birthDate?: string|null, color?: string|null }`
- Removed legacy translation fields: `sireName`, `damName` (no longer stored/returned).

### Staff create horse
**POST** `/horses` (multipart/form-data)
- required: `slug`, `category`
- optional: `birthDate`, `heightCm`, `owner`, `notes`, `isActive`, `pedigree`, `coverImage`
- `translations`: **optional**
  - omit / empty / `{}` → create horse without translation rows
  - or send `{ en?: {...}, ar?: {...} }`
    - for each locale you include as a non-empty object: `name` + `description` are required
    - other optional fields per locale: `subtitle`, `shortBio`, `tags`, `metaTitle`, `metaDescription`, `bloodline`, `color`, `breeder`

### Staff update horse (partial translation upsert)
**PATCH** `/horses/:id` (multipart/form-data)
- any base fields optional
- `coverImage` optional
- `pedigree` optional:
  - omit → no change
  - send `{}` (as JSON string) → clears pedigree
- `translations` optional:
  - when sent, it **merges** into existing locale rows
  - only locales allowed: `en`, `ar`
  - if a locale row doesn’t exist yet, backend will create it **only if** you provide non-empty `name` and `description` for that locale

### Public list/detail now return localized color/breeder
- Public list (`GET /public/horses?...locale=en|ar`) returns `translations[0].color` (for that locale).
- Public detail (`GET /public/horses/:slug?locale=en|ar`) returns:
  - `translation.color` and `translation.breeder` (for that locale)
  - `pedigree` on root horse

---

## 2) Horses — media upload (batch)

### Add media images (batch)
**POST** `/horses/:id/media` (multipart/form-data)
- files field: `files` (1–10 images)
- max: **10 MB** per file
- allowed types: jpeg, png, webp, gif
- optional body: `caption?`, `sortOrder?`

Returns `201` with an **array** of created media rows.

### Replace media file
**PATCH** `/horses/:id/media/:mediaId/file` (multipart/form-data)
- file field: `file` (single)
- max: **10 MB** per file

---

## 3) Public horse detail now includes suggestions

**GET** `/public/horses/:slug?locale=en|ar`

Response now includes:
- `suggestedHorses`: **0–4** card-shaped horses (same shape as list rows), localized to the requested `locale`.
  - same category first (newest), then fill from other categories (newest)
  - excludes current horse
  - only includes horses that have a translation row for the requested locale

---

## 4) Gallery (staff-only, max 20 total)

See also: `README_GALLERY_CHANGES.md`.

Endpoints:
- **GET** `/gallery` (JWT + staff role)
- **POST** `/gallery` (multipart, JWT + staff role)
  - field `files`: 1..20 images (10MB max each, allowed mime types)
  - global cap enforced: total gallery rows cannot exceed 20
  - optional body applied to all: `instagramLink?`, `crops?` (JSON), `sortOrderBase?`
- **PATCH** `/gallery/:id` (JSON, JWT + staff role)
- **DELETE** `/gallery/:id` (JWT + staff role)

---

## 5) Settings (singleton)

See also: `README_SETTINGS_CHANGES.md`.

### Public (landing lazy load)
- **GET** `/public/settings`
  - returns `null` if not configured, otherwise singleton settings object

### Staff upsert
- **PUT** `/settings` (JWT + staff role)
  - create if missing, otherwise update provided fields
  - localized fields are `{ en?: string, ar?: string }`

---

## 6) Dynamic landing pages (fixed keys)

Public lazy load:
- **GET** `/public/pages/:key?locale=en|ar`
  - `key`: `home|farm|news|events|horses|contact`
  - returns `{ key, coverImage, coverCrop, isActive, translation }`
  - `translation` contains localized: `title`, `subtitle`, `text`, `metaDescription`, `metaKeywords`
  - returns `404` if missing or inactive

Staff management:
- **GET** `/pages`
- **GET** `/pages/:key`
- **PUT** `/pages/:key` (multipart)
  - file `coverImage` optional (10MB, allowed types)
  - fields: `coverCrop` (JSON), `translations` (JSON), `isActive`
- **DELETE** `/pages/:key`

Frontend path mapping:
- `/` → `home`
- `/farm` → `farm`
- `/news` → `news`
- `/events` → `events`
- `/horses` → `horses`
- `/contact` → `contact`

