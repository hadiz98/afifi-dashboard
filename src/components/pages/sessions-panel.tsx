"use client";

import { MonitorSmartphone, RefreshCw, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, readApiData } from "@/lib/api";
import { toastApiError } from "@/lib/toast-api-error";
import {
  clearAuthSession,
  getCurrentSessionRowId,
} from "@/lib/auth-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthUser } from "@/hooks/use-auth-user";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;

function extractSessions(data: unknown): Row[] {
  if (Array.isArray(data)) {
    return data.filter((x): x is Row => !!x && typeof x === "object");
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const list =
      o.sessions ??
      o.items ??
      o.data ??
      o.rows ??
      o.refreshSessions ??
      o.results;
    if (Array.isArray(list)) {
      return list.filter((x): x is Row => !!x && typeof x === "object");
    }
  }
  return [];
}

function cellId(row: Row): string {
  for (const key of [
    "id",
    "_id",
    "sessionId",
    "session_id",
    "refreshSessionId",
    "tokenId",
  ]) {
    const v = row[key];
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function rowUserAgent(row: Row): string {
  const v = row.userAgent ?? row.user_agent ?? row.device ?? row.client;
  return typeof v === "string" && v.length > 0 ? v : "—";
}

function rowIp(row: Row): string {
  const v = row.ip ?? row.ipAddress ?? row.ip_address;
  return typeof v === "string" && v.length > 0 ? v : "—";
}

function rowIsCurrent(row: Row, id: string): boolean {
  if (row.isCurrent === true || row.current === true) {
    return true;
  }
  const stored = getCurrentSessionRowId();
  return id.length > 0 && stored != null && stored === id;
}

function rowUserLabel(row: Row): { primary: string; secondary?: string } {
  const user = row.user;
  if (user && typeof user === "object") {
    const u = user as Record<string, unknown>;
    const name = typeof u.name === "string" ? u.name : "";
    const email = typeof u.email === "string" ? u.email : "";
    if (name && email) return { primary: name, secondary: email };
    if (name) return { primary: name };
    if (email) return { primary: email };
  }
  const email = row.userEmail ?? row.email;
  if (typeof email === "string" && email.length > 0) return { primary: email };
  const name = row.userName ?? row.name;
  if (typeof name === "string" && name.length > 0) return { primary: name };
  const userId = row.userId ?? row.user_id;
  if (typeof userId === "string" && userId.length > 0) return { primary: userId };
  return { primary: "—" };
}

function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function SessionsPanel() {
  const t = useTranslations("SessionsPage");
  const locale = useLocale();
  const router = useRouter();
  const { roles } = useAuthUser();
  const canRevoke = roles.some((r) => r === "admin" || r === "superadmin");
  const formatDate = useCallback((value: unknown): string => {
    if (typeof value !== "string" || value.length === 0) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(d);
    } catch {
      return d.toISOString();
    }
  }, [locale]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/sessions", { method: "GET" });
      const data = await readApiData<unknown>(res);
      setRows(extractSessions(data));
    } catch (e) {
      toastApiError(e, t("loadError"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(row: Row) {
    if (!canRevoke) return;
    const id = cellId(row);
    if (!id) return;
    const wasCurrent = rowIsCurrent(row, id);
    setRevoking(id);
    try {
      const res = await apiFetch(`/api/auth/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        await readApiData<unknown>(res);
      }
      toast.success(t("revoked"));
      if (wasCurrent) {
        clearAuthSession();
        router.replace("/login");
        return;
      }
      await load();
    } catch (e) {
      toastApiError(e, t("revokeError"));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <MonitorSmartphone className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatBadge>{loading ? "…" : rows.length} {t("countLabel")}</StatBadge>
          {!canRevoke ? <StatBadge>{t("viewOnly")}</StatBadge> : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={loading}
            onClick={() => void load()}
            aria-label={t("refresh")}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
          </Button>
        </div>
      </div>

      {/* ── List card ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {loading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="ms-auto h-7 w-20 rounded-lg" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="m-4 rounded-xl border border-dashed border-border/60 bg-muted/10 py-20 text-center">
            <MonitorSmartphone className="mx-auto size-10 text-muted-foreground/40" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-foreground">{t("empty")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-transparent">
                  <TableHead className="ps-6 text-start min-w-[10rem]">{t("colUser")}</TableHead>
                  <TableHead className="text-start min-w-[7rem] whitespace-nowrap">{t("colId")}</TableHead>
                  <TableHead className="text-start min-w-[12rem]">{t("colClient")}</TableHead>
                  <TableHead className="text-start whitespace-nowrap">{t("colIp")}</TableHead>
                  <TableHead className="text-start whitespace-nowrap">{t("colCreated")}</TableHead>
                  <TableHead className="text-start whitespace-nowrap">{t("colExpires")}</TableHead>
                  <TableHead className="text-center w-[1%] whitespace-nowrap">{t("colCurrent")}</TableHead>
                  <TableHead className="pe-6 text-end w-[1%] whitespace-nowrap">{t("colAction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const id = cellId(row);
                  const current = rowIsCurrent(row, id);
                  const ua = rowUserAgent(row);
                  const who = rowUserLabel(row);
                  return (
                    <TableRow key={id || JSON.stringify(row)} className="hover:bg-muted/20">
                      <TableCell className="ps-6">
                        <p className="truncate text-sm font-semibold text-foreground">{who.primary}</p>
                        {who.secondary ? (
                          <p className="truncate text-xs text-muted-foreground">{who.secondary}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[8rem] font-mono text-xs text-muted-foreground" title={id || undefined}>
                        {id ? (id.length > 12 ? `${id.slice(0, 8)}…` : id) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[min(24rem,50vw)] truncate text-sm" title={ua !== "—" ? ua : undefined}>
                        {ua.length > 100 ? `${ua.slice(0, 100)}…` : ua}
                      </TableCell>
                      <TableCell className="text-sm">{rowIp(row)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(row.createdAt ?? row.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(row.expiresAt ?? row.expires_at)}
                      </TableCell>
                      <TableCell className="text-center">
                        {current ? (
                          <Badge variant="default" className="text-[10px] font-normal">
                            {t("currentBadge")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="pe-6 text-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          disabled={!canRevoke || !id || revoking === id}
                          onClick={() => void revoke(row)}
                          title={!canRevoke ? t("noRevokePermission") : undefined}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                          {t("revoke")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
