# Horses API (for frontend)

This doc describes the Horses feature endpoints and payloads for the frontend.

## Static images

If `coverImage` is set, it is stored as a relative URL:
- `/images/horses/<filename>`

So the frontend loads it from:
- `http://<API_HOST>:<PORT>/images/horses/<filename>`

## Locales

Supported locales:
- `en`
- `ar`

## Public endpoints (no auth)

### List horses (summary, paginated)
`GET /api/public/horses?locale=en&page=1&limit=20&category=stallion&activeOnly=true`

- **Required**: `locale` (`en|ar`)
- **Optional**: `category` (`stallion|mare|filly|colt`)
- **Optional**: `activeOnly` (`true|false`, default `true`)

Returns:
- `data[]` with minimal fields (optimized for cards): `slug`, `category`, `coverImage`, `pedigree`, plus translation fields for the chosen `locale` (`name`, `subtitle`, `shortBio`, `tags`, `color`)
- `meta` pagination info

### Horse details by slug (full)
`GET /api/public/horses/:slug?locale=en`

Returns:
- base horse fields: `category`, `birthDate`, `coverImage`, `heightCm`, `owner`, `notes`, `pedigree` (structured relatives, not localized), etc.
- `translation` for the requested locale (`description`, `color`, `breeder`, `bloodline`, meta, etc.)
- `media[]` and `awards[]` arrays

## Staff endpoints (JWT + role)

Staff roles allowed:
- `superadmin`, `admin`, `moderator`

All staff endpoints require:
- `Authorization: Bearer <accessToken>`

### Admin list (paginated)
`GET /api/horses?page=1&limit=20`

Returns horses with translations, excluding large translation `description` to keep payload smaller.

### Admin get by id
`GET /api/horses/:id`

Returns full horse including translations/media/awards.

### Create horse (multipart/form-data)
`POST /api/horses`

Body fields:
- `slug` (string, unique)
- `category` (`stallion|mare|filly|colt`)
- `birthDate` (optional ISO8601 string)
- `heightCm` (optional int)
- `owner` (optional)
- `notes` (optional)
- `isActive` (optional: `1/0/true/false`)
- `translations` (optional JSON string): omit on create for a “fast create” flow; when present, must include **both** `en` and `ar` (see below).
- `pedigree` (optional JSON string): `{ "father"?: { "name"?, "birthDate"?, "color"? }, "mother"?: {...}, "grandfather"?: {...}, "grandmother"?: {...} }` — not localized

File:
- `coverImage` (optional image)

**Translations JSON (when sent; must include BOTH `en` and `ar`)**

```json
{
  "en": {
    "name": "Afifi Example",
    "subtitle": "Senior Stallion",
    "description": "Full profile text...",
    "shortBio": "Short card text...",
    "tags": ["Champion", "Breeding"],
    "metaTitle": "Afifi Example - Stallion",
    "metaDescription": "SEO description...",
    "color": "Chestnut",
    "breeder": "Stud farm name",
    "bloodline": "Bloodline text..."
  },
  "ar": {
    "name": "مثال",
    "subtitle": "فحل",
    "description": "النص الكامل...",
    "shortBio": "نص مختصر...",
    "tags": ["بطل"],
    "metaTitle": "مثال",
    "metaDescription": "وصف...",
    "color": "كستنائي",
    "breeder": "اسم المربي",
    "bloodline": "النسب..."
  }
}
```

### Update horse (multipart/form-data)
`PATCH /api/horses/:id`

- **Partial update**: include only fields you want to change.
- Optional body fields (same names as create):
  - `slug`, `category`, `birthDate`, `heightCm`, `owner`, `notes`, `isActive`
  - `translations` (optional JSON string): omit when not editing copy. When present, send **only the locale(s) you are updating**, e.g. `{ "en": { ... } }` or `{ "ar": { ... } }`. Each value uses the same shape as one entry in the create example above. The server should **merge** each supplied locale into the existing horse and leave other locales unchanged.
  - `pedigree` (optional): omit to leave unchanged, or send an empty string / `{}` to clear.
  - `coverImage` (optional file): replaces the cover when sent.

### Delete horse (soft delete)
`DELETE /api/horses/:id`

## Media management (staff)

All endpoints below require JWT + staff role.

### List media
`GET /api/horses/:id/media`

### Add images (batch)
`POST /api/horses/:id/media` (multipart/form-data)

- file field: `files` — 1–10 images per request (same field name repeated or multiple files in one part)
- max **10 MB** per file; types: jpeg, png, webp, gif
- body fields: `caption?`, `sortOrder?` (applied to all new rows; `sortOrder` is the base value, then +1 for each file)

Returns an array of created media records (`201`).

### Replace image file
`PATCH /api/horses/:id/media/:mediaId/file` (multipart/form-data)

- file field: `file` (required); max **10 MB**, same image types as above

Behavior:
- updates DB `url` to the new file
- deletes old file after success

### Update media metadata
`PATCH /api/horses/:id/media/:mediaId` (JSON)

Body:
- `caption?`
- `sortOrder?`

### Delete media
`DELETE /api/horses/:id/media/:mediaId`

Behavior:
- deletes DB row
- attempts to delete the file from disk (ignores missing file)

### Reorder media (bulk)
`PATCH /api/horses/:id/media/reorder` (JSON)

The body can be either a **JSON array** or an object with an **`items`** array:

```json
[
  { "id": "media-uuid-1", "sortOrder": 0 },
  { "id": "media-uuid-2", "sortOrder": 10 }
]
```

```json
{
  "items": [
    { "id": "media-uuid-1", "sortOrder": 0 },
    { "id": "media-uuid-2", "sortOrder": 10 }
  ]
}
```

## Awards management (staff)

### List awards
`GET /api/horses/:id/awards`

### Add award
`POST /api/horses/:id/awards`

```json
{
  "year": 2026,
  "eventName": "KIAHF",
  "title": "Gold Champion",
  "placing": "1st",
  "location": "Riyadh",
  "notes": "Optional"
}
```

### Update award
`PATCH /api/horses/:id/awards/:awardId`

### Delete award
`DELETE /api/horses/:id/awards/:awardId`

