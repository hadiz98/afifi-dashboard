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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function SessionsPanel() {
  const t = useTranslations("SessionsPage");
  const locale = useLocale();
  const router = useRouter();
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
    <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="border-b bg-card px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50",
                  "text-muted-foreground"
                )}
              >
                <MonitorSmartphone className="size-5" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold tracking-tight">
                  {t("title")}
                </CardTitle>
                <CardDescription className="mt-1 max-w-xl text-sm">
                  {t("description")}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                {loading ? "…" : rows.length} {t("countLabel")}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw
                  className={cn("size-3.5", loading && "animate-spin")}
                  aria-hidden
                />
                {t("refresh")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[7rem] whitespace-nowrap">
                      {t("colId")}
                    </TableHead>
                    <TableHead className="min-w-[12rem]">
                      {t("colClient")}
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      {t("colIp")}
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      {t("colCreated")}
                    </TableHead>
                    <TableHead className="whitespace-nowrap">
                      {t("colExpires")}
                    </TableHead>
                    <TableHead className="w-[1%] whitespace-nowrap text-center">
                      {t("colCurrent")}
                    </TableHead>
                    <TableHead className="w-[1%] text-end whitespace-nowrap">
                      {t("colAction")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const id = cellId(row);
                    const current = rowIsCurrent(row, id);
                    const ua = rowUserAgent(row);
                    return (
                      <TableRow key={id || JSON.stringify(row)}>
                        <TableCell
                          className="max-w-[8rem] font-mono text-xs text-muted-foreground"
                          title={id || undefined}
                        >
                          {id
                            ? id.length > 12
                              ? `${id.slice(0, 8)}…`
                              : id
                            : "—"}
                        </TableCell>
                        <TableCell
                          className="max-w-[min(24rem,50vw)] truncate text-sm"
                          title={ua !== "—" ? ua : undefined}
                        >
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
                        <TableCell className="text-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="gap-1"
                            disabled={!id || revoking === id}
                            onClick={() => void revoke(row)}
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
        </CardContent>
      </Card>
    </div>
  );
}
