# Settings (singleton) — API changes to frontend

All routes are under the global prefix **`/api`**.

## Public (landing page lazy load)

### Get site settings (singleton)
**GET** `/api/public/settings`

Returns `null` if not configured yet, otherwise the settings object.

**Response (200 OK)**:

```json
{
  "id": "uuid",
  "websiteName": { "en": "Afifi Farm", "ar": "مزرعة عفيفي" },
  "instagramLink": "https://instagram.com/...",
  "youtubeLink": "https://youtube.com/...",
  "facebookLink": "https://facebook.com/...",
  "contactEmail": "info@example.com",
  "address": { "en": "Riyadh, KSA", "ar": "الرياض، السعودية" },
  "phoneNumber": "+966...",
  "visitingHours": { "en": "Sun–Thu 9am–5pm", "ar": "الأحد–الخميس ٩ص–٥م" },
  "whatsappNumber": "+966...",
  "footerText": { "en": "© 2026 Afifi", "ar": "© ٢٠٢٦ عفيفي" },
  "createdAt": "2026-04-02T12:00:00.000Z",
  "updatedAt": "2026-04-02T12:00:00.000Z"
}
```

Notes:
- All fields are **optional**.
- Localized fields are objects with **only** `en` and/or `ar` keys.

---

## Staff upsert (create if missing, otherwise update)

### Upsert site settings
**PUT** `/api/settings`

Auth:
- `Authorization: Bearer <accessToken>`
- Role: `superadmin` | `admin` | `moderator`

Body (JSON): all optional fields; send only what you want to change.

Example:

```json
{
  "websiteName": { "en": "Afifi Farm", "ar": "مزرعة عفيفي" },
  "contactEmail": "info@afifi.com",
  "instagramLink": "https://instagram.com/afifi",
  "address": { "en": "Riyadh", "ar": "الرياض" },
  "visitingHours": { "en": "Daily 9–5", "ar": "يومياً ٩–٥" },
  "footerText": { "en": "All rights reserved.", "ar": "جميع الحقوق محفوظة." }
}
```

Behavior:
- If the singleton row doesn’t exist yet, it is created.
- Otherwise, the existing row is updated **only for provided fields**.
- For string fields: send an empty string `\"\"` to clear that field.
- For localized fields: send `{}` (or `{ \"en\": \"\", \"ar\": \"\" }`) to clear.

