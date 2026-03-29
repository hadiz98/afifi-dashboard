function pickString(
  obj: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function pickSessionId(obj: Record<string, unknown>): string | undefined {
  for (const key of [
    "sessionId",
    "currentSessionId",
    "refreshSessionId",
    "session_id",
  ]) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  const session = obj.session;
  if (session && typeof session === "object") {
    const s = session as Record<string, unknown>;
    const id = s.id ?? s.sessionId;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return undefined;
}

function pickExpiresInSeconds(obj: Record<string, unknown>): number | undefined {
  const raw = obj.expiresIn ?? obj.expires_in;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === "string") {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** Unwrap one level if tokens live under `data` (full API envelope or nested). */
function unwrapAuthPayload(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  let o = data as Record<string, unknown>;
  const hasTokens =
    pickString(o, ["accessToken", "access_token"]) !== undefined;
  if (hasTokens) return o;
  if (o.data && typeof o.data === "object") {
    o = o.data as Record<string, unknown>;
  }
  return o;
}

export type AuthBundle = {
  accessToken: string;
  refreshToken: string;
  user: unknown;
  /** Access token lifetime in seconds (e.g. JWT `exp` window), when API sends it. */
  expiresIn?: number;
  /** Refresh-session row id for the current login, when API sends it (sessions UI). */
  sessionId?: string;
};

export function normalizeAuthBundle(data: unknown): AuthBundle | null {
  const o = unwrapAuthPayload(data);
  if (!o) return null;

  let accessToken = pickString(o, ["accessToken", "access_token"]);
  let refreshToken = pickString(o, ["refreshToken", "refresh_token"]);
  if (
    (!accessToken || !refreshToken) &&
    o.tokens &&
    typeof o.tokens === "object"
  ) {
    const tokens = o.tokens as Record<string, unknown>;
    accessToken =
      accessToken ?? pickString(tokens, ["accessToken", "access_token"]);
    refreshToken =
      refreshToken ?? pickString(tokens, ["refreshToken", "refresh_token"]);
  }
  if (!accessToken || !refreshToken) return null;

  const user =
    "user" in o
      ? o.user
      : "profile" in o
        ? o.profile
        : null;
  const expiresIn = pickExpiresInSeconds(o);
  const sessionId = pickSessionId(o);

  return {
    accessToken,
    refreshToken,
    user: user ?? null,
    ...(expiresIn !== undefined ? { expiresIn } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
  };
}
