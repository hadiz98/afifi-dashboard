import { ApiError } from "@/lib/api-error";
import {
  clearAuthSession,
  getAccessToken,
  getAccessTokenExpiresAtMs,
  getRefreshToken,
  redirectToLogin,
  setAuthSession,
} from "@/lib/auth-session";
import { normalizeAuthBundle } from "@/lib/auth-normalize";

export type ApiFetchOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefreshRetry?: boolean;
};

function apiBaseUrl(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not set");
  }
  return base;
}

function buildUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${apiBaseUrl()}${normalized}`;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(buildUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok || !body || typeof body !== "object") {
        return false;
      }

      const record = body as { success?: boolean; data?: unknown };
      if (record.success === false) return false;

      // Support both:
      // - { success: true, data: { accessToken, refreshToken, ... } }
      // - { accessToken, refreshToken, ... }
      const payload =
        "data" in record && record.data !== undefined ? record.data : body;

      const bundle = normalizeAuthBundle(payload);
      if (!bundle) return false;

      setAuthSession(
        {
          accessToken: bundle.accessToken,
          refreshToken: bundle.refreshToken,
          user: bundle.user,
          expiresIn: bundle.expiresIn,
          sessionId: bundle.sessionId,
        },
        { fromRefresh: true }
      );
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function authFailure(): void {
  clearAuthSession();
  redirectToLogin();
}

async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Low-level fetch to the Nest API: prefixes base URL, optional Bearer token,
 * one refresh+retry on 401 (unless skipped).
 */
export async function apiFetch(
  path: string,
  init: ApiFetchOptions = {}
): Promise<Response> {
  const {
    skipAuth,
    skipRefreshRetry,
    headers: initHeaders,
    ...rest
  } = init;

  const method = (rest.method ?? "GET").toUpperCase();
  const normalizedPath = path.replace(/\/$/, "");
  const isRefreshCall = normalizedPath.endsWith("/api/auth/refresh");

  const doFetch = async (): Promise<Response> => {
    const headers = new Headers(initHeaders);
    const body = rest.body;
    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;
    const isUrlSearchParams =
      typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams;

    // Only auto-set JSON content-type when the caller is sending JSON.
    // For multipart/form-data (news image upload), we must NOT set it.
    if (!headers.has("Content-Type") && body && !isFormData && !isUrlSearchParams) {
      headers.set("Content-Type", "application/json");
    }
    if (!skipAuth) {
      // If we have a client-side expiry hint, refresh *before* the request
      // so the UI doesn't first hit a 401 and then recover.
      if (typeof window !== "undefined") {
        const expiresAtMs = getAccessTokenExpiresAtMs();
        const shouldRefresh =
          typeof expiresAtMs === "number" &&
          Number.isFinite(expiresAtMs) &&
          Date.now() >= expiresAtMs - 5_000;
        if (shouldRefresh) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            authFailure();
          }
        }
      }
      const token = getAccessToken();
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    return fetch(buildUrl(path), {
      ...rest,
      method,
      headers,
    });
  };

  let res = await doFetch();

  if (
    res.status === 401 &&
    !skipRefreshRetry &&
    !skipAuth &&
    !isRefreshCall &&
    typeof window !== "undefined"
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    } else {
      authFailure();
      throw new ApiError("Session expired", { statusCode: 401 });
    }
  }

  return res;
}

/**
 * Parses a JSON API envelope: throws ApiError when success === false.
 * Supports ok responses with a raw array, empty body (204), or objects without a `data` field.
 */
export async function readApiData<T = unknown>(res: Response): Promise<T> {
  const body = await parseJsonResponse(res);

  if (!res.ok) {
    throw ApiError.fromBody(body, res.status);
  }

  if (body === null || body === undefined) {
    return undefined as T;
  }

  if (Array.isArray(body)) {
    return body as T;
  }

  if (typeof body === "object") {
    const record = body as { success?: boolean; data?: unknown };
    if (record.success === false) {
      throw ApiError.fromBody(body, res.status);
    }
    if ("data" in record && record.data !== undefined) {
      if (record.success === true || record.success === undefined) {
        return record.data as T;
      }
    }
    return body as T;
  }

  return body as T;
}

export async function apiJson<T = unknown>(
  path: string,
  init: ApiFetchOptions = {}
): Promise<T> {
  const res = await apiFetch(path, init);
  return readApiData<T>(res);
}
