"use client";

import { useEffect, useState } from "react";
import { apiFetch, readApiData } from "@/lib/api";
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

function extractUserFromMeResponse(raw: unknown): unknown | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  // Common envelope shapes.
  if ("user" in o) return o.user ?? null;
  if ("profile" in o) return o.profile ?? null;
  if ("data" in o && o.data && typeof o.data === "object") {
    const d = o.data as Record<string, unknown>;
    if ("user" in d) return d.user ?? null;
    if ("profile" in d) return d.profile ?? null;
  }

  // Fallback: assume response itself is the user payload.
  return raw;
}

export function DashboardAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await apiFetch("/api/auth/me", { method: "GET" });
        const raw = await readApiData<unknown>(res);

        const bundle = normalizeAuthBundle(raw);
        if (bundle) {
          // Server can return updated tokens + user.
          setAuthSession(
            {
              accessToken: bundle.accessToken,
              refreshToken: bundle.refreshToken,
              user: bundle.user,
              expiresIn: bundle.expiresIn,
              sessionId: bundle.sessionId,
            },
            { fromRefresh: false }
          );
        } else {
          // If /me only returns user profile, keep existing tokens and update stored user.
          const accessToken = getAccessToken();
          const refreshToken = getRefreshToken();
          if (accessToken && refreshToken) {
            const user = extractUserFromMeResponse(raw);
            const expiresAtMs = getAccessTokenExpiresAtMs();
            const expiresIn =
              typeof expiresAtMs === "number"
                ? Math.max(0, (expiresAtMs - Date.now()) / 1000)
                : undefined;

            setAuthSession({
              accessToken,
              refreshToken,
              user,
              ...(expiresIn && Number.isFinite(expiresIn) && expiresIn > 0
                ? { expiresIn }
                : {}),
            });
          }
        }
      } catch (e) {
        // `apiFetch` already clears the session + redirects on auth failures.
        if (e instanceof ApiError && e.statusCode === 401) {
          // No-op: `apiFetch` + `authFailure()` in `src/lib/api.ts` clears session storage
          // (so `useAuthUser` becomes logged out) and redirects to the login page.
          return;
        } else {
          // For unexpected failures, fail safe by clearing.
          clearAuthSession();
          redirectToLogin();
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-svh w-full flex items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}

