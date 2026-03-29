export function parseUserRoles(user: unknown): string[] {
  if (!user || typeof user !== "object") return [];
  const u = user as Record<string, unknown>;
  const raw = u.roles ?? u.role;
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  for (const r of raw) {
    if (typeof r === "string" && r.length > 0) {
      names.push(r.toLowerCase());
      continue;
    }
    if (r && typeof r === "object" && "name" in r) {
      const n = (r as { name: unknown }).name;
      if (typeof n === "string" && n.length > 0) names.push(n.toLowerCase());
    }
  }
  return names;
}

export function isStaffRole(roles: string[]): boolean {
  return roles.some((r) => r === "admin" || r === "superadmin");
}

export function isSuperadmin(roles: string[]): boolean {
  return roles.some((r) => r === "superadmin");
}

export function pickUserDisplayName(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  const u = user as Record<string, unknown>;
  const name = u.name ?? u.fullName;
  if (typeof name === "string" && name.length > 0) return name;
  const email = u.email;
  if (typeof email === "string") return email;
  return "";
}

export function pickUserEmail(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  const e = (user as Record<string, unknown>).email;
  return typeof e === "string" ? e : "";
}
