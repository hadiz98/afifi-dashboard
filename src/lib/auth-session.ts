const ACCESS = "afifi_access_token";
const REFRESH = "afifi_refresh_token";
const USER = "afifi_user";
const SESSION_COOKIE = "afifi_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function isBrowser(): boolean {
  return typeof window !== "undefined";
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

export function setAuthSession(payload: {
  accessToken: string;
  refreshToken: string;
  user: unknown;
}): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(ACCESS, payload.accessToken);
  sessionStorage.setItem(REFRESH, payload.refreshToken);
  sessionStorage.setItem(USER, JSON.stringify(payload.user ?? null));
  document.cookie = `${SESSION_COOKIE}=1; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax`;
}

export function clearAuthSession(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(ACCESS);
  sessionStorage.removeItem(REFRESH);
  sessionStorage.removeItem(USER);
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0`;
}

export function redirectToLogin(): void {
  if (!isBrowser()) return;
  const locale = document.documentElement.lang || "en";
  window.location.assign(`/${locale}/login`);
}
