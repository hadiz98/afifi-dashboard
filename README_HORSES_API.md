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
- `data[]` with minimal fields (optimized for cards): `slug`, `category`, `coverImage`, plus translation fields for the chosen `locale` (`name`, `subtitle`, `shortBio`, `tags`)
- `meta` pagination info

### Horse details by slug (full)
`GET /api/public/horses/:slug?locale=en`

Returns:
- base horse fields (category, birthDate, color, coverImage, etc.)
- `translation` object for the requested locale (includes `description`, pedigree fields, meta)
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
- `color` (optional)
- `heightCm` (optional int)
- `breeder` (optional)
- `owner` (optional)
- `notes` (optional)
- `isActive` (optional: `1/0/true/false`)
- `translations` (**required**) JSON string (see below)

File:
- `coverImage` (optional image)

**Translations JSON (required; must include BOTH `en` and `ar`)**

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
    "sireName": "Sire Name",
    "damName": "Dam Name",
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
    "sireName": "اسم الأب",
    "damName": "اسم الأم",
    "bloodline": "النسب..."
  }
}
```

### Update horse (multipart/form-data)
`PATCH /api/horses/:id`

- Same fields as create, all optional **except**:\n
  - `translations` is **required** and will **replace** both locales.
- `coverImage` is optional; if sent, it replaces the previous file.

### Delete horse (soft delete)
`DELETE /api/horses/:id`

