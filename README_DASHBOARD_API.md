# Dashboard API (for frontend)

This doc describes the **staff dashboard summary** endpoint used to render the dashboard main page immediately after auto-login.

## Endpoint

`GET /api/dashboard/summary?locale=en`

- **Auth**: Required (JWT)
- **Roles allowed**: `superadmin`, `admin`, `moderator`
- **Headers**:
  - `Authorization: Bearer <accessToken>`
- **Query params**:
  - `locale` (optional): `en | ar` (default `en`)

## What this endpoint is for

One fast request that returns:

- KPI counts (totals, active/inactive, upcoming/today events)
- Recent lists (latest news, horses, upcoming events, latest newsletter subscribers)

It is optimized to avoid heavy fields (e.g. does **not** include translation `description` in lists).

## Response shape

```json
{
  "news": {
    "total": 0,
    "active": 0,
    "inactive": 0,
    "recent": [
      {
        "id": "...",
        "date": "...",
        "isActive": true,
        "image": "/images/news/...",
        "translations": [
          { "locale": "en", "title": "...", "subtitle": "..." }
        ]
      }
    ]
  },
  "horses": {
    "total": 0,
    "active": 0,
    "inactive": 0,
    "byCategory": { "stallion": 0, "mare": 0, "filly": 0, "colt": 0 },
    "recent": [
      {
        "id": "...",
        "slug": "...",
        "category": "stallion",
        "isActive": true,
        "coverImage": "/images/horses/...",
        "updatedAt": "..."
      }
    ]
  },
  "events": {
    "total": 0,
    "active": 0,
    "inactive": 0,
    "upcoming": 0,
    "today": 0,
    "upcomingList": [
      {
        "id": "...",
        "slug": "...",
        "startsAt": "...",
        "endsAt": null,
        "isActive": true,
        "image": "/images/events/...",
        "translation": { "locale": "en", "title": "...", "subtitle": "..." }
      }
    ]
  },
  "newsletter": {
    "total": 0,
    "recent": [
      { "id": "...", "email": "...", "createdAt": "..." }
    ]
  }
}
```

### Notes

- `events.upcomingList.translation` is only the requested locale (`locale=en|ar`).
- Recent lists are small (News/Horses/Events: 5 items, Newsletter: 10 items).

## Typical frontend usage

- Call this endpoint once after login (or on dashboard mount).
- If it returns `403`, hide the staff dashboard (user does not have staff role).
- Use `locale` from the app’s current language to localize the event titles/subtitles returned in `upcomingList`.

