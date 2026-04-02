# Frontend handoff: News & Events — rich content + SEO meta

All routes use the global prefix **`/api`**. Staff news/events endpoints require auth (JWT) as before; public routes stay unauthenticated.

This document describes the **translation payload and response shape** after the backend refactor: legacy `description` / `subDescription` (news) are removed; use **`fullContent`** plus optional **`metaTitle`** / **`metaDescription`**.

---

## Shared: `translations` field (multipart)

Create/update still send **`translations`** as a **JSON string** in **`multipart/form-data`** (same as today).

- Whole field max length: **250000** characters (validators).
- Allowed locale keys: **`en`**, **`ar`** only.

### Per-locale object — **News**

| Field | Required | Notes |
|--------|-----------|--------|
| `title` | yes | string |
| `fullContent` | yes | string, non-empty after trim, **max 50000** characters (e.g. HTML from shadcn/Lexical editor) |
| `tags` | yes | non-empty string array |
| `subtitle` | no | string; omit or empty → stored as empty |
| `metaTitle` | no | string, max **255**; omit / empty → `null` |
| `metaDescription` | no | string, max **500**; omit / empty → `null` |

- At least **one** locale (`en` and/or `ar`) must be present in the object.
- Unknown keys are ignored.

### Per-locale object — **Events**

| Field | Required | Notes |
|--------|-----------|--------|
| `title` | yes | string |
| `subtitle` | yes | string |
| `fullContent` | yes | string, non-empty after trim, **max 50000** characters |
| `metaTitle` | no | max **255** |
| `metaDescription` | no | max **500** |

- **Both** `en` and **`ar` must** be included (same rule as before).

### Removed fields (do not send)

- News: **`description`**, **`subDescription`**
- Events: **`description`**

Map old “body” / rich text to **`fullContent`**.

---

## News — API summary

### Staff

| Method | Path | Body |
|--------|------|------|
| `GET` | `/news` | query: `page`, `limit` |
| `GET` | `/news/:id` | — |
| `POST` | `/news` | multipart: `date` (ISO8601), `translations` (JSON string), optional `image`, `isActive` |
| `PATCH` | `/news/:id` | same + optional `clearImage` |
| `DELETE` | `/news/:id` | soft delete |

### Public

| Method | Path | Query |
|--------|------|--------|
| `GET` | `/public/news` | **`locale`** = `en` \| `ar`, `page`, `limit`, optional `activeOnly` |
| `GET` | `/public/news/:id` | **`locale`** = `en` \| `ar` |

### Response shapes (what changed)

**List responses** (admin `GET /news`, public `GET /public/news`): translation rows still expose **`id`**, **`locale`**, **`title`**, **`subtitle`**, **`tags`** only — **not** `fullContent` or meta (keeps lists small).

**Detail responses**

- Staff: `GET /news/:id` — full `translations[]` including:
  - `fullContent`, `metaTitle`, `metaDescription`, plus existing fields.
- Public: `GET /public/news/:id` — `translation` is the full row for the requested locale:

```json
{
  "id": "…",
  "image": "/images/news/…",
  "date": "…",
  "isActive": true,
  "translation": {
    "id": "…",
    "locale": "en",
    "title": "…",
    "subtitle": "…",
    "fullContent": "<p>…</p>",
    "metaTitle": "… or null",
    "metaDescription": "… or null",
    "tags": ["…"]
  }
}
```

Use **`fullContent`** for rendering rich HTML (sanitize on the client as you already do for CMS content). Use **`metaTitle`** / **`metaDescription`** for `<title>` / `<meta name="description">` on the article detail page.

---

## Events — API summary

### Staff

| Method | Path | Body |
|--------|------|------|
| `GET` | `/events` | `page`, `limit` |
| `GET` | `/events/:id` | — |
| `POST` | `/events` | multipart: `slug`, `startsAt`, optional `endsAt`, `translations`, optional `image`, `isActive` |
| `PATCH` | `/events/:id` | same + optional `clearImage` |
| `DELETE` | `/events/:id` | soft delete |

### Public

| Method | Path | Query |
|--------|------|--------|
| `GET` | `/public/events` | **`locale`**, `page`, `limit`, optional `from`, `to`, `activeOnly` |
| `GET` | `/public/events/:slug` | **`locale`** |

### Response shapes

**List responses**: translations on each item still **`id`**, **`locale`**, **`title`**, **`subtitle`** only.

**Detail** (`GET /public/events/:slug`, staff `GET /events/:id`): `translation` includes **`fullContent`**, **`metaTitle`**, **`metaDescription`**.

```json
{
  "id": "…",
  "slug": "…",
  "startsAt": "…",
  "endsAt": "…",
  "image": "…",
  "isActive": true,
  "translation": {
    "id": "…",
    "locale": "en",
    "title": "…",
    "subtitle": "…",
    "fullContent": "<p>…</p>",
    "metaTitle": "… or null",
    "metaDescription": "… or null"
  }
}
```

---

## Frontend checklist

1. Replace all reads of `translation.description` / `subDescription` (news) with **`fullContent`**.
2. On create/update forms, serialize the rich editor output (e.g. HTML string) into **`fullContent`** per locale.
3. Add optional SEO fields: **`metaTitle`**, **`metaDescription`** in admin UI; bind to detail page meta tags when present.
4. Enforce **50k** character limit on `fullContent` in the UI to match API (optional but improves UX).
5. Events: ensure **`translations` JSON always includes both `en` and `ar`** with the new fields.

---

## TypeScript-style types (reference)

```ts
type NewsLocale = 'en' | 'ar';

type NewsTranslationInput = {
  title: string;
  fullContent: string;
  tags: string[];
  subtitle?: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

type NewsTranslationsPayload = Partial<Record<NewsLocale, NewsTranslationInput>>;

type EventTranslationInput = {
  title: string;
  subtitle: string;
  fullContent: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

// Events API requires both locales:
type EventTranslationsPayload = Record<NewsLocale, EventTranslationInput>;
```

---

*Generated for handoff from backend news/events translation refactor (full content + optional meta, removal of description/subDescription on news and description on events).*
