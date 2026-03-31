"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Plus,
  RefreshCw,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { apiFetch, readApiData } from "@/lib/api";
import { toastApiError } from "@/lib/toast-api-error";
import { RoleBadge } from "@/components/role-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useAuthUser } from "@/hooks/use-auth-user";
import { isSuperadmin as isSuperadminRole, parseUserRoles } from "@/lib/user";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;

type RoleRow = { id: string; name: string; description: string | null };

function extractUsersPage(
  data: unknown
): { rows: Row[]; total: number; page: number; totalPages: number } {
  let rows: Row[] = [];
  let total = 0;
  let page = 1;
  const limit = 20;

  if (Array.isArray(data)) {
    rows = data.filter((x): x is Row => !!x && typeof x === "object");
    total = rows.length;
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const list = o.users ?? o.items ?? o.data;
    if (Array.isArray(list)) {
      rows = list.filter((x): x is Row => !!x && typeof x === "object");
    }
    const meta = o.meta as Record<string, unknown> | undefined;
    if (meta) {
      const t = meta.total;
      const p = meta.page;
      const l = meta.limit;
      if (typeof t === "number") total = t;
      if (typeof p === "number") page = p;
      if (typeof l === "number" && total > 0) {
        return {
          rows,
          total,
          page,
          totalPages: Math.max(1, Math.ceil(total / l)),
        };
      }
    }
    if (typeof o.total === "number") total = o.total;
    if (typeof o.page === "number") page = o.page;
  }

  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  return { rows, total: total || rows.length, page, totalPages };
}

function rowEmail(r: Row): string {
  const e = r.email;
  return typeof e === "string" ? e : "—";
}

function rowName(r: Row): string {
  const n = r.name;
  return typeof n === "string" ? n : "—";
}

function rowActive(r: Row): boolean {
  const a = r.isActive;
  return a === true;
}

function rowId(r: Row): string | null {
  const v = r.id ?? r.userId ?? r._id;
  if (typeof v === "string" && v.length > 0) return v;
  if (typeof v === "number") return String(v);
  return null;
}

function rowIsModeratorOnly(roles: string[]): boolean {
  // "admin user can deactivate only mod users"
  // Allow only if the target has moderator and does NOT have admin/superadmin.
  const set = new Set(roles);
  return set.has("moderator") && !set.has("admin") && !set.has("superadmin");
}

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseRolesList(data: unknown): RoleRow[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? (((data as Record<string, unknown>).roles ??
          (data as Record<string, unknown>).items ??
          (data as Record<string, unknown>).data) as unknown)
      : null;
  if (!Array.isArray(list)) return [];
  const out: RoleRow[] = [];
  for (const x of list) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const id = safeString(r.id);
    const name = safeString(r.name).toLowerCase();
    if (!id || !name) continue;
    out.push({
      id,
      name,
      description: typeof r.description === "string" ? r.description : null,
    });
  }
  return out;
}

function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  isActive: z.boolean(),
});

const setPasswordSchema = z.object({
  password: z.string().min(8),
});

export function UsersPanel() {
  const t = useTranslations("UsersPage");
  const { roles: myRoles, isSuperadmin, user } = useAuthUser();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bundle, setBundle] = useState<{
    rows: Row[];
    total: number;
    totalPages: number;
  }>({ rows: [], total: 0, totalPages: 1 });

  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleOptions, setRoleOptions] = useState<RoleRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<{
    name: string;
    email: string;
    password: string;
    isActive: boolean;
    roleIds: string[];
  }>({ name: "", email: "", password: "", isActive: true, roleIds: [] });

  const [toggleOpen, setToggleOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<{ id: string; name: string; active: boolean; roles: string[] } | null>(null);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string; email: string } | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const myId = useMemo(() => {
    if (!user || typeof user !== "object") return null;
    const id = (user as Record<string, unknown>).id;
    return typeof id === "string" ? id : null;
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/api/users?page=${page}&limit=20`,
        { method: "GET" }
      );
      const data = await readApiData<unknown>(res);
      const parsed = extractUsersPage(data);
      setBundle({
        rows: parsed.rows,
        total: parsed.total,
        totalPages: parsed.totalPages,
      });
    } catch (e) {
      toastApiError(e, t("loadError"));
      setBundle({ rows: [], total: 0, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const res = await apiFetch("/api/roles", { method: "GET" });
      const data = await readApiData<unknown>(res);
      setRoleOptions(parseRolesList(data));
    } catch (e) {
      setRoleOptions([]);
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!createOpen) return;
    if (roleOptions.length > 0 || rolesLoading) return;
    void loadRoles();
  }, [createOpen, loadRoles, roleOptions.length, rolesLoading]);

  const canCreateUser = useMemo(() => {
    const set = new Set(myRoles);
    return set.has("admin") || set.has("superadmin");
  }, [myRoles]);

  const selectableRoleIds = useMemo(() => {
    // Per requirement: admin can assign only moderator + admin.
    // Superadmin can assign all roles.
    if (isSuperadmin) return new Set(roleOptions.map((r) => r.id));
    const allowedNames = new Set(["moderator", "admin"]);
    return new Set(roleOptions.filter((r) => allowedNames.has(r.name)).map((r) => r.id));
  }, [isSuperadmin, roleOptions]);

  function canToggleUser(targetId: string, targetRoles: string[]): boolean {
    if (myId && targetId === myId) return false; // prevent self-lockout
    if (isSuperadmin) return true;
    // admin (non-superadmin): only moderators (per your rule)
    return rowIsModeratorOnly(targetRoles);
  }

  function canSetPassword(targetId: string): boolean {
    if (!isSuperadmin) return false;
    if (myId && targetId === myId) return false;
    return true;
  }

  async function onCreateUser() {
    setCreateError(null);
    const parsed = createUserSchema.safeParse({
      name: createForm.name,
      email: createForm.email,
      password: createForm.password,
      isActive: createForm.isActive,
    });
    if (!parsed.success) {
      setCreateError(t("createInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          password: createForm.password,
          isActive: createForm.isActive,
          roleIds: createForm.roleIds.length ? createForm.roleIds : undefined,
        }),
      });
      await readApiData<unknown>(res);
      setCreateOpen(false);
      setCreateForm({ name: "", email: "", password: "", isActive: true, roleIds: [] });
      await load();
    } catch (e) {
      toastApiError(e, t("createError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleActive() {
    if (!toggleTarget) return;
    setSubmitting(true);
    try {
      const path = toggleTarget.active ? "deactivate" : "activate";
      const res = await apiFetch(`/api/users/${encodeURIComponent(toggleTarget.id)}/${path}`, {
        method: "PATCH",
      });
      await readApiData<unknown>(res);
      setToggleOpen(false);
      setToggleTarget(null);
      await load();
    } catch (e) {
      toastApiError(e, t("updateError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSetPassword() {
    setPasswordError(null);
    if (!passwordTarget) return;
    const parsed = setPasswordSchema.safeParse({ password: newPassword });
    if (!parsed.success) {
      setPasswordError(t("passwordInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(passwordTarget.id)}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPassword }),
      });
      await readApiData<unknown>(res);
      setPasswordOpen(false);
      setPasswordTarget(null);
      setNewPassword("");
    } catch (e) {
      toastApiError(e, t("passwordError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <Users className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatBadge>{loading ? "…" : bundle.total} {t("total")}</StatBadge>
          <StatBadge>{t("page")} {page} / {bundle.totalPages}</StatBadge>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
            disabled={loading} onClick={() => void load()} aria-label={t("refresh")}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          {canCreateUser && (
            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => setCreateOpen(true)} disabled={submitting}>
              <Plus className="size-3.5" />{t("addUser")}
            </Button>
          )}
        </div>
      </div>

      {/* ── List card ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {loading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="ms-auto h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : bundle.rows.length === 0 ? (
          <div className="m-4 rounded-xl border border-dashed border-border/60 bg-muted/10 py-20 text-center">
            <Users className="mx-auto size-10 text-muted-foreground/40" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-foreground">{t("empty")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-transparent">
                <TableHead className="ps-6 text-start">{t("colName")}</TableHead>
                <TableHead className="text-start">{t("colEmail")}</TableHead>
                <TableHead className="text-start">{t("colStatus")}</TableHead>
                <TableHead className="text-start">{t("colRoles")}</TableHead>
                <TableHead className="pe-6 text-end">{t("colAction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bundle.rows.map((row, idx) => {
                const id = rowId(row);
                const roles = parseUserRoles(row);
                const active = rowActive(row);
                const canToggle = id ? canToggleUser(id, roles) : false;
                const canPwd = id ? canSetPassword(id) : false;
                return (
                  <TableRow key={(id ?? rowEmail(row)) + String(idx)} className="hover:bg-muted/20">
                    <TableCell className="ps-6 font-medium">{rowName(row)}</TableCell>
                    <TableCell className="text-muted-foreground">{rowEmail(row)}</TableCell>
                    <TableCell>
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />{t("active")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          <XCircle className="size-3" />{t("inactive")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {roles.length > 0 ? (
                          roles.map((r) => <RoleBadge key={r} role={r} />)
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="pe-6 text-end">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          disabled={!id || submitting || !canToggle}
                          onClick={() => {
                            if (!id) return;
                            setToggleTarget({ id, name: rowName(row), active, roles });
                            setToggleOpen(true);
                          }}
                        >
                          {active ? t("deactivate") : t("activate")}
                        </Button>
                        {canPwd ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2.5 text-xs"
                            disabled={!id || submitting}
                            onClick={() => {
                              if (!id) return;
                              setPasswordError(null);
                              setNewPassword("");
                              setPasswordTarget({ id, name: rowName(row), email: rowEmail(row) });
                              setPasswordOpen(true);
                            }}
                          >
                            <KeyRound className="size-3.5" />
                            {t("setPassword")}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {!loading && bundle.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
            <p className="text-xs text-muted-foreground">{t("page")} {page} / {bundle.totalPages}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5 text-xs"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3.5 rtl:rotate-180" aria-hidden />
                {t("prev")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2.5 text-xs"
                disabled={page >= bundle.totalPages || loading}
                onClick={() => setPage((p) => Math.min(bundle.totalPages, p + 1))}
              >
                {t("next")}
                <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Create user */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden sm:max-w-[560px]">
          <DialogHeader className="shrink-0 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <UserPlus className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {t("dialogCreateTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogCreateDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-4 py-4 pr-1">
              {createError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {createError}
                </p>
              ) : null}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("fieldName")}
                  </Label>
                  <Input className="h-9" value={createForm.name} onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("fieldEmail")}
                  </Label>
                  <Input className="h-9" inputMode="email" value={createForm.email} onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("fieldPassword")}
                  </Label>
                  <Input className="h-9" type="password" value={createForm.password} onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                    <p className="text-xs text-muted-foreground">{createForm.isActive ? t("active") : t("inactive")}</p>
                  </div>
                  <Switch checked={createForm.isActive} onCheckedChange={(v) => setCreateForm((s) => ({ ...s, isActive: v }))} />
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("fieldRoles")}</p>
                  <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                    {rolesLoading ? t("loadingRoles") : `${roleOptions.length}`}
                  </Badge>
                </div>
                {roleOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("rolesHint")}</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {roleOptions.map((r) => {
                      const checked = createForm.roleIds.includes(r.id);
                      const disabled = !selectableRoleIds.has(r.id);
                      return (
                        <label
                          key={r.id}
                          className={cn(
                            "flex items-start gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-sm",
                            disabled && "opacity-60"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            disabled={disabled}
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setCreateForm((s) => ({
                                ...s,
                                roleIds: next
                                  ? Array.from(new Set([...s.roleIds, r.id]))
                                  : s.roleIds.filter((x) => x !== r.id),
                              }));
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium capitalize">{r.name}</p>
                            {r.description ? (
                              <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
                            ) : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          <Separator className="shrink-0" />
          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setCreateOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void onCreateUser()} className="gap-1.5 min-w-24">
              <Plus className="size-3.5" />
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activate / deactivate confirm */}
      <Dialog open={toggleOpen} onOpenChange={setToggleOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {toggleTarget?.active ? t("dialogDeactivateTitle") : t("dialogActivateTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {toggleTarget?.active ? t("dialogDeactivateDescription") : t("dialogActivateDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-sm font-semibold">{toggleTarget?.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {(toggleTarget?.roles ?? []).join(", ") || "—"}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setToggleOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant={toggleTarget?.active ? "destructive" : "default"}
              disabled={submitting || !toggleTarget}
              onClick={() => void onToggleActive()}
              className="gap-1.5"
            >
              {toggleTarget?.active ? t("deactivate") : t("activate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set password (superadmin only) */}
      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <KeyRound className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {t("dialogPasswordTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("dialogPasswordDescription")}
            </DialogDescription>
          </DialogHeader>
          {passwordError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {passwordError}
            </p>
          ) : null}
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-sm font-semibold">{passwordTarget?.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{passwordTarget?.email ?? ""}</p>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("fieldNewPassword")}
            </Label>
            <Input type="password" className="h-9" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setPasswordOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={submitting || !passwordTarget} onClick={() => void onSetPassword()} className="gap-1.5">
              {t("savePassword")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
