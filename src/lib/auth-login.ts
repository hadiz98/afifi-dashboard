import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { normalizeAuthBundle } from "@/lib/auth-normalize";
import { setAuthSession } from "@/lib/auth-session";

export async function loginWithPassword(email: string, password: string) {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    skipAuth: true,
    skipRefreshRetry: true,
  });

  const raw = await readApiData<unknown>(res);
  const bundle = normalizeAuthBundle(raw);
  if (!bundle) {
    throw new ApiError("Invalid login response", { statusCode: 502 });
  }
  setAuthSession({
    accessToken: bundle.accessToken,
    refreshToken: bundle.refreshToken,
    user: bundle.user,
    expiresIn: bundle.expiresIn,
    sessionId: bundle.sessionId,
  });
  return bundle;
}
