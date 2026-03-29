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

export type AuthBundle = {
  accessToken: string;
  refreshToken: string;
  user: unknown;
};

export function normalizeAuthBundle(data: unknown): AuthBundle | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
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
  const user = "user" in o ? o.user : "profile" in o ? o.profile : null;
  return { accessToken, refreshToken, user };
}
