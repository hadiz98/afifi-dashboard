# Events API (for frontend)

This doc describes the Events feature endpoints and payloads.

## Static images

If `image` is set, it is stored as a relative URL:
- `/images/events/<filename>`

So the frontend loads it from:
- `http://<API_HOST>:<PORT>/images/events/<filename>`

## Locales

Supported locales:
- `en`
- `ar`

## Public endpoints (no auth)

### List events (summary, paginated)
`GET /api/public/events?locale=en&page=1&limit=20&from=2026-04-01T00:00:00.000Z&to=2026-05-01T00:00:00.000Z&activeOnly=true`

- **Required**: `locale` (`en|ar`)
- **Optional**: `from` (ISO date/time)
- **Optional**: `to` (ISO date/time)
- **Optional**: `activeOnly` (`true|false`, default `true`)

Returns:
- `data[]` with minimal fields: `slug`, `startsAt`, `endsAt`, `image`, plus a single translation row (selected by `locale`) containing `title`, `subtitle`
- `meta` pagination info

### Event detail by slug (full)
`GET /api/public/events/:slug?locale=en`

Returns:
- base event fields: `slug`, `startsAt`, `endsAt`, `image`, `isActive`
- `translation` object for the requested locale (includes `title`, `subtitle`, `description`)

## Staff endpoints (JWT + role)

Staff roles allowed:
- `superadmin`, `admin`, `moderator`

All staff endpoints require:
- `Authorization: Bearer <accessToken>`

### Admin list (paginated)
`GET /api/events?page=1&limit=20`

Returns events with translations, excluding large `description` to keep payload smaller.

### Admin get by id
`GET /api/events/:id`

Returns full event including both translations.

### Create event (multipart/form-data)
`POST /api/events`

Body fields:
- `slug` (string, unique)
- `startsAt` (**required**) ISO8601 string
- `endsAt` (optional) ISO8601 string
- `isActive` (optional: `1/0/true/false`)
- `translations` (**required**) JSON string (see below)

File:
- `image` (optional image)

**Translations JSON (required; must include BOTH `en` and `ar`)**

```json
{
  "en": {
    "title": "Event title",
    "subtitle": "Event subtitle",
    "description": "Long description..."
  },
  "ar": {
    "title": "عنوان",
    "subtitle": "عنوان فرعي",
    "description": "وصف طويل..."
  }
}
```

### Update event (multipart/form-data)
`PATCH /api/events/:id`

Body fields:
- same as create; **`translations` is required** and replaces both locales
- to clear image as part of update (optional): `clearImage=1` (or use the delete image endpoint below)

File:
- `image` (optional image). If sent, it replaces the previous file.

### Delete event (soft delete)
`DELETE /api/events/:id`

### Delete event image (keep event)
`DELETE /api/events/:id/image`

