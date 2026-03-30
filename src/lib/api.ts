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
  // De-duplicate concurrent refresh calls — all callers share one in-flight promise.
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        console.warn("[auth] No refresh token available — cannot refresh.");
        return false;
      }

      const res = await fetch(buildUrl("/api/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      // Log the raw response for debugging without swallowing it.
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        console.warn("[auth] Refresh response was not valid JSON.");
        return false;
      }

      if (!res.ok) {
        console.warn("[auth] Refresh request failed with status", res.status, body);
        return false;
      }

      if (!body || typeof body !== "object") {
        console.warn("[auth] Refresh response body is empty or not an object:", body);
        return false;
      }

      const record = body as { success?: boolean; data?: unknown };

      // Explicit failure flag from the server.
      if (record.success === false) {
        console.warn("[auth] Server returned success=false on refresh:", body);
        return false;
      }

      // Support both:
      //   { success: true, data: { accessToken, refreshToken, ... } }
      //   { accessToken, refreshToken, ... }
      const payload =
        "data" in record && record.data !== undefined ? record.data : body;

      const bundle = normalizeAuthBundle(payload);
      if (!bundle) {
        // Log the raw payload so you can fix normalizeAuthBundle if needed.
        console.warn(
          "[auth] normalizeAuthBundle returned null — the server shape may not be handled. Payload:",
          payload
        );
        return false;
      }

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

      console.info("[auth] Token refreshed successfully.");
      return true;
    } catch (err) {
      console.error("[auth] Unexpected error during token refresh:", err);
      return false;
    } finally {
      // Always clear so the next call can try again.
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function authFailure(): void {
  console.warn("[auth] Auth failure — clearing session and redirecting to login.");
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

    if (!headers.has("Content-Type") && body && !isFormData && !isUrlSearchParams) {
      headers.set("Content-Type", "application/json");
    }

    if (!skipAuth) {
      if (typeof window !== "undefined") {
        const expiresAtMs = getAccessTokenExpiresAtMs();
        const isExpiredOrExpiringSoon =
          typeof expiresAtMs === "number" &&
          Number.isFinite(expiresAtMs) &&
          Date.now() >= expiresAtMs - 5_000;

        if (isExpiredOrExpiringSoon) {
          // BUG FIX: Previously this block was empty on failure, letting
          // the request fire with a known-expired token and causing a 401
          // that then triggered authFailure(). Now we eagerly refresh and
          // only proceed if it succeeded.
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            // Refresh failed proactively — no point sending the request.
            // Fall through and let the 401 handler below decide (it will
            // try once more before calling authFailure).
            console.warn("[auth] Proactive refresh failed; request will likely 401.");
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

  // If we got a 401 and haven't already retried, attempt one refresh+retry.
  if (
    res.status === 401 &&
    !skipRefreshRetry &&
    !skipAuth &&
    !isRefreshCall &&
    typeof window !== "undefined"
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry the original request with the new token.
      res = await doFetch();
    } else {
      // Both refresh attempts failed — the session is genuinely dead.
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