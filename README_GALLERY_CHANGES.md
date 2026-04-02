# Gallery (staff-only) — API changes to frontend

All routes are under the global prefix **`/api`**.

## Auth / roles
All gallery endpoints require:
- `Authorization: Bearer <accessToken>`
- Role: **`superadmin` | `admin` | `moderator`**

## Static files
Uploaded images are stored as relative URLs like:
- `/images/gallery/<filename>`

Frontend loads them from:
- `http(s)://<API_HOST>/images/gallery/<filename>`

## Global limits
- **Gallery total max**: **20 images** (global cap across the whole site)
- **Upload max per request**: up to **20 files**
- **Max size per file**: **10 MB**
- **Allowed mime**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

---

## Endpoints

### List gallery images
**GET** `/api/gallery`

Returns all gallery images ordered by `sortOrder ASC, createdAt ASC`.

### Add gallery images (batch upload)
**POST** `/api/gallery` (multipart/form-data)

- **files field**: `files` (**required**) — 1..20 images per request
- Optional body fields (applied to all uploaded rows):
  - `instagramLink` (string)
  - `crops` (JSON string; stored metadata only)
  - `sortOrderBase` (int; each next file uses `sortOrderBase + i`)

**Global cap rule**: if `existingCount + incomingCount > 20` → `400 Bad Request`.

### Update gallery image metadata
**PATCH** `/api/gallery/:id` (JSON)

Body fields (all optional):
- `instagramLink` (string) — send empty string to clear
- `crops` (JSON string) — send empty string to clear
- `sortOrder` (int)

### Delete gallery image
**DELETE** `/api/gallery/:id`

Deletes DB row and attempts to delete the file from disk (best-effort).

---

## `crops` JSON format (stored only)
Backend stores crop metadata; it does **not** crop images server-side.

Example:

```json
{
  "presets": [
    {
      "key": "square",
      "targetW": 1080,
      "targetH": 1080,
      "x": 0,
      "y": 0,
      "w": 100,
      "h": 100,
      "unit": "percent"
    }
  ]
}
```

