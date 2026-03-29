# Afifi dashboard (frontend)

Next.js dashboard for the NestJS auth API described in the repo’s [`backend.md`](../backend.md). Target stack: **Next.js**, **shadcn/ui**, **Tailwind CSS**, with **English** and **Arabic**, **LTR/RTL**, and **role-aware** navigation.

---

## Prerequisites

- Node.js 20+ (matches Next 16 expectations)
- Running API with global prefix `/api` (see [`backend.md`](../backend.md))

---

## Quick start

```bash
npm install
cp .env.example .env.local   # create if missing; see Environment below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port Next prints).

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |

---

## Environment

Create **`.env.local`** in this folder:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

- Build request URLs as `` `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/...` ``.
- On the API, set **`CLIENT_URL`** to your Next origin (e.g. `http://localhost:3001`) so CORS allows the browser.

---

## Backend contract (summary)

- Responses use `success`, `statusCode`, `data`, and on failure `error`, `message`, `path`, `timestamp` (see [`backend.md`](../backend.md)).
- Protected calls: header `Authorization: Bearer <accessToken>`.
- Login body: `{ "email", "password" }`; refresh/logout body: `{ "refreshToken" }`.

Full endpoint tables (auth, users, roles) and role rules are in [`backend.md`](../backend.md).

---

## Product behavior (target)

| Area | Behavior |
|------|----------|
| **Authentication** | Login → store access + refresh + user; refresh rotation; logout / logout-all; optional sessions UI for `/api/auth/sessions`. |
| **Errors** | Parse API errors; map 401 to sign-out or refresh; show toasts / inline messages; optional `error.tsx` / error boundary for unexpected failures. |
| **Routes** | Dashboard pages align with API capabilities (profile, password, sessions, users, roles). |
| **Protection** | **Every route is protected except login** (middleware + layout guard). |
| **Layout** | Dashboard shell with **shadcn navigation on the right** (natural for RTL). |
| **i18n** | Locales **`en`** and **`ar`** (e.g. `next-intl` with `/[locale]/…`). |
| **Direction** | `dir="ltr"` for `en`, `dir="rtl"` for `ar`; prefer logical Tailwind (`ms-*`, `me-*`, `ps-*`, `pe-*`). |
| **Authorization (UI)** | Show staff sections (users, roles) only when `GET /api/auth/me` (or JWT claims) includes `admin` / `superadmin` per backend rules. |

---

## API → pages (reference)

| API | UI |
|-----|-----|
| `POST /api/auth/login` | Login (public) |
| `GET /api/auth/me` | User chip, guards |
| `POST /api/auth/change-password` | Change password |
| `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id` | Sessions |
| `GET/PATCH /api/users/profile` | Profile |
| `GET/POST /api/users`, … staff operations | Users admin |
| `GET/POST/PATCH/DELETE /api/roles` | Roles admin |

---

## Implementation steps

Follow in order; adjust names to match your preferences.

### 1. Tooling and UI kit

1. Initialize **shadcn/ui** in this project (`npx shadcn@latest init`), choose style aligned with Tailwind 4.
2. Add components as needed: `button`, `input`, `label`, `card`, `dropdown-menu`, `separator`, `avatar`, `sheet` (mobile), `sidebar` or custom nav, `table`, `sonner` (toasts), `form` (if using RHF + zod).

### 2. Internationalization and RTL

1. Add **`next-intl`** (or equivalent): plugin in `next.config`, request config (`src/i18n/request.ts`), message files e.g. `messages/en.json`, `messages/ar.json`.
2. Use the **App Router segment** `src/app/[locale]/layout.tsx`: set `<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>`.
3. Keep **user-visible strings** in message catalogs; avoid hard-coded copy in components.
4. Add a **locale switcher** in the shell; persist choice (`cookie` or `localStorage`) per next-intl docs.

### 3. HTTP client and API errors

1. Add a small **`apiFetch`** (or `ky`/`axios`) wrapper in e.g. `src/lib/api.ts`:
   - Prefix with `NEXT_PUBLIC_API_BASE_URL`.
   - Attach `Authorization` when an access token exists.
   - On **`401`**, try **refresh** once, then retry; if refresh fails, clear session and redirect to login.
2. Parse JSON body: if `success === false`, throw a typed error with `statusCode` and `message` for the UI.
3. Centralize **toast** or alert dispatch from that layer or a thin hook.

### 4. Auth state and persistence

1. Choose **where tokens live**: e.g. `memory` + **`sessionStorage`** for refresh (simple SPA-style), or **httpOnly cookies** via Next **Route Handlers** that proxy the API (stronger XSS posture, more work).
2. Implement **`login`**, **`logout`**, **`logoutAll`**, and **`refresh`** calling the matching `/api/auth/*` routes.
3. After login, hydrate user with **`GET /api/auth/me`** (or use login response if it already includes roles).
4. Expose auth via **React context** or **Zustand** so layouts and guards can read `user` and `accessToken`.

### 5. Route protection

1. Add **`middleware.ts`** at the project root:
   - Match `[locale]/login` as **public**.
   - For other `[locale]/*` paths, require a **session signal** the middleware can read (e.g. lightweight cookie set on login, or signed session cookie if you proxy auth).
2. In **`(dashboard)/layout.tsx`**, add a **client fallback**: if no user, redirect to `/{locale}/login` to avoid flash on first paint.
3. Ensure **login** redirects authenticated users to `/{locale}` or dashboard home.

### 6. App structure (suggested)

```text
src/
  app/
    [locale]/
      (auth)/
        login/page.tsx
      (dashboard)/
        layout.tsx          # right-hand shadcn nav + outlet
        page.tsx            # home
        profile/page.tsx
        password/page.tsx
        sessions/page.tsx
        users/...
        roles/...
    layout.tsx              # minimal root if needed
  components/
    ui/                     # shadcn
    dashboard-nav.tsx       # right sidebar / nav
  lib/
    api.ts
    auth-store.ts
  i18n/
  messages/
```

Use **route groups** `(auth)` and `(dashboard)` so layouts stay separate without affecting URLs.

### 7. Role-based navigation

1. Derive **role names** from `user.roles` (or whatever `me` returns).
2. Build nav items: everyone sees dashboard, profile, password, sessions; **`admin` / `superadmin`** also see users and roles.
3. **Mirror backend rules** in UI (e.g. disable actions you know the API will reject); still rely on API for enforcement.

### 8. Pages (functional checklist)

- [ ] **Login** — form, error display, lockout message if backend returns 429/403 with message.
- [ ] **Home** — welcome + short cuts.
- [ ] **Profile** — load/patch `/api/users/profile`.
- [ ] **Change password** — `POST /api/auth/change-password`; warn that all sessions end.
- [ ] **Sessions** — list, revoke one row.
- [ ] **Users** (staff) — table with pagination, create user, activate/deactivate, set password, assign roles (superadmin-only for assigning superadmin role).
- [ ] **Roles** (staff) — CRUD per API.

### 9. Polish

1. Loading **skeletons** and empty states on tables.
2. **Metadata** per locale (`generateMetadata` with translations).
3. Optional: **dark mode** via `next-themes` if shadcn theme supports it.

---

## Security notes (frontend)

- Never log **access/refresh** tokens.
- Prefer **short access TTL** and refresh flow documented in [`backend.md`](../backend.md).
- Be aware of **refresh reuse** behavior: a failed refresh should clear local session and send the user to login.

---

## Related docs

- Full API reference, payloads, and roles: [`backend.md`](../backend.md).
