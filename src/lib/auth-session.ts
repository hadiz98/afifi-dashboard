/** Fired on the window when session storage auth state changes (same tab). */
export const AFIFI_AUTH_CHANGED_EVENT = "afifi-auth-changed";

const ACCESS = "afifi_access_token";
const REFRESH = "afifi_refresh_token";
const USER = "afifi_user";
const ACCESS_EXPIRES_AT_MS = "afifi_access_expires_at_ms";
const SESSION_COOKIE = "afifi_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function emitAuthChanged(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(AFIFI_AUTH_CHANGED_EVENT));
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(ACCESS);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(REFRESH);
}

export function getStoredUserJson(): string | null {
  if (!isBrowser()) return null;
  return sessionStorage.getItem(USER);
}

/** Epoch ms when access token should be treated as expired (client hint; verify with API). */
export function getAccessTokenExpiresAtMs(): number | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(ACCESS_EXPIRES_AT_MS);
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function setAuthSession(payload: {
  accessToken: string;
  refreshToken: string;
  user: unknown;
  expiresIn?: number;
}): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(ACCESS, payload.accessToken);
  sessionStorage.setItem(REFRESH, payload.refreshToken);
  sessionStorage.setItem(USER, JSON.stringify(payload.user ?? null));

  if (
    payload.expiresIn != null &&
    Number.isFinite(payload.expiresIn) &&
    payload.expiresIn > 0
  ) {
    sessionStorage.setItem(
      ACCESS_EXPIRES_AT_MS,
      String(Date.now() + Math.floor(payload.expiresIn * 1000))
    );
  } else {
    sessionStorage.removeItem(ACCESS_EXPIRES_AT_MS);
  }

  document.cookie = `${SESSION_COOKIE}=1; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax`;
  emitAuthChanged();
}

export function clearAuthSession(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(ACCESS);
  sessionStorage.removeItem(REFRESH);
  sessionStorage.removeItem(USER);
  sessionStorage.removeItem(ACCESS_EXPIRES_AT_MS);
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0`;
  emitAuthChanged();
}

export function redirectToLogin(): void {
  if (!isBrowser()) return;
  const locale = document.documentElement.lang || "en";
  window.location.assign(`/${locale}/login`);
}
