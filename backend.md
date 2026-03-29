# Auth backend

NestJS REST API for authentication and role-based user management, backed by **MySQL** and **TypeORM**. Access tokens are JWTs; refresh tokens use rotation, hashing at rest, and reuse detection.

---

## Requirements

- Node.js 18+
- MySQL 8+

---

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`: database credentials, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (use long random strings in production).

Create the database:

```sql
CREATE DATABASE auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Start the API (dev):

```bash
npm run start:dev
```

Seed roles and default accounts (run from project root):

```bash
npx ts-node src/database/seed.ts
```

Defaults from seed (change immediately):

| Account     | Email (env override)   | Default password   |
|------------|-------------------------|--------------------|
| Admin      | `ADMIN_EMAIL` or `admin@example.com` | `ADMIN_PASSWORD` or `Admin@123456` |
| Superadmin | `SUPERADMIN_EMAIL` or `superadmin@example.com` | `SUPERADMIN_PASSWORD` or `SuperAdmin@123456` |

New end users are created by **superadmin or admin** via `POST /api/users` (there is no public self-registration).

---

## Base URL

All routes are under the global prefix **`/api`** (no version segment).

Example: `http://localhost:3000/api/auth/login`

---

## Response shape

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { },
  "timestamp": "2026-03-29T12:00:00.000Z"
}
```

Errors:

```json
{
  "success": false,
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "...",
  "path": "/api/...",
  "timestamp": "..."
}
```

---

## Roles

| Role         | Purpose |
|--------------|---------|
| `user`       | Default logged-in user |
| `moderator`  | Reserved for your app logic |
| `admin`      | Staff: manage users and roles; **cannot** deactivate a **superadmin** |
| `superadmin` | Staff: same as admin, **can** deactivate superadmins; **only** role that can **assign** `superadmin` |

User accounts are **never deleted** via this API (no delete-user endpoint).

---

## Endpoints

### Auth (`/api/auth`)

| Method | Path | Auth | Description |
|--------|------|------|--------------|
| POST | `/login` | — | Email + password → access JWT + refresh token + user |
| POST | `/refresh` | Refresh JWT (body) | Rotate refresh token; returns new pair |
| POST | `/logout` | Bearer access | Revoke one refresh token (send it in body) |
| POST | `/logout-all` | Bearer access | Revoke all refresh tokens for user |
| POST | `/change-password` | Bearer access | Current + new password; revokes all sessions |
| GET | `/me` | Bearer access | Current user (password stripped) |
| GET | `/sessions` | Bearer access | Active sessions (refresh rows) |
| DELETE | `/sessions/:id` | Bearer access | Revoke one session by id |

**Login body**

```json
{ "email": "user@example.com", "password": "secret" }
```

**Refresh / logout body**

```json
{ "refreshToken": "<raw refresh token from login or refresh>" }
```

Use header `Authorization: Bearer <accessToken>` for protected routes.

---

### Users (`/api/users`)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/` | JWT | superadmin, admin | Paginated list (`?page=1&limit=20`) |
| POST | `/` | JWT | superadmin, admin | Create user (optional `roleIds`, `isActive`) |
| GET | `/profile` | JWT | any | Current user profile |
| PATCH | `/profile` | JWT | any | Update own name/email |
| GET | `/:id` | JWT | superadmin, admin | User by id |
| PATCH | `/:id/activate` | JWT | superadmin, admin | Activate |
| PATCH | `/:id/deactivate` | JWT | superadmin, admin | Deactivate (admin cannot target superadmin) |
| PATCH | `/:id/password` | JWT | superadmin, admin | Set user password (staff reset) |
| PATCH | `/:id/roles` | JWT | superadmin, admin | Replace roles (`roleIds[]`; only superadmin may include superadmin role) |

**Create user (staff)**

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "Secret@123",
  "isActive": true,
  "roleIds": ["optional-uuid-of-role"]
}
```

**Assign roles**

```json
{ "roleIds": ["uuid-role-1", "uuid-role-2"] }
```

---

### Roles (`/api/roles`)

Staff only (**superadmin** or **admin**).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List roles |
| GET | `/:id` | Get role |
| POST | `/` | Create role (`name` must be a valid `RoleName` enum value) |
| PATCH | `/:id` | Update description |
| DELETE | `/:id` | Delete role row |

---

## Security notes

- Access and refresh tokens use separate secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`).
- Load secrets from `.env` (see `import 'dotenv/config'` in `main.ts`).
- Refresh tokens are stored **SHA-256 hashed**; the client holds the raw token.
- Suspected refresh-token reuse revokes the whole **family** of tokens for that chain.
- Failed logins: lockout after **5** attempts for **15 minutes**.
- SQL logging to the console is off by default; set `TYPEORM_LOGGING=true` to debug queries.

---

## Environment reference

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP port (default `3000`) |
| `NODE_ENV` | `development` / `production` (affects `synchronize`) |
| `CLIENT_URL` | CORS origin (default `*`) |
| `DB_*` | MySQL host, port, name, user, password |
| `JWT_ACCESS_SECRET` | Access JWT secret |
| `JWT_ACCESS_EXPIRES_IN` | e.g. `15m` |
| `JWT_REFRESH_SECRET` | Refresh JWT secret |
| `JWT_REFRESH_EXPIRES_IN` | e.g. `7d` |
| `BCRYPT_SALT_ROUNDS` | Default `12` |
| `TYPEORM_LOGGING` | `true` to log SQL |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Seed |

---

## Project layout

```
src/
  main.ts
  app.module.ts
  auth/           # login, refresh, sessions, password
  users/          # profiles + staff user CRU (no delete)
  roles/          # role CRUD
  common/         # guards, decorators, filter, interceptor
  database/
    entities/
    seed.ts
```

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm run start` | Run `dist/main.js` |
