"use client";

import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiData } from "@/lib/api";
import { toastApiError } from "@/lib/toast-api-error";
import { RoleBadge } from "@/components/role-badge";
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
import { parseUserRoles } from "@/lib/user";
import { cn } from "@/lib/utils";

type Row = Record<string, unknown>;

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

export function UsersPanel() {
  const t = useTranslations("UsersPage");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<{
    rows: Row[];
    total: number;
    totalPages: number;
  }>({ rows: [], total: 0, totalPages: 1 });

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

  useEffect(() => {
    void load();
  }, [load]);

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
                <Users className="size-5" aria-hidden />
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
                {t("total")}: {loading ? "…" : bundle.total}
              </Badge>
              <Badge
                variant="outline"
                className="font-normal text-muted-foreground"
              >
                {t("page")} {page} / {bundle.totalPages}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="gap-1"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
              {t("prev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= bundle.totalPages || loading}
              onClick={() =>
                setPage((p) => Math.min(bundle.totalPages, p + 1))
              }
              className="gap-1"
            >
              {t("next")}
              <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : bundle.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colName")}</TableHead>
                    <TableHead>{t("colEmail")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead>{t("colRoles")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.rows.map((row, idx) => {
                    const roles = parseUserRoles(row);
                    const active = rowActive(row);
                    return (
                      <TableRow key={rowEmail(row) + String(idx)}>
                        <TableCell className="font-medium">{rowName(row)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {rowEmail(row)}
                        </TableCell>
                        <TableCell>
                          {active ? (
                            <Badge variant="secondary">{t("active")}</Badge>
                          ) : (
                            <Badge variant="destructive">{t("inactive")}</Badge>
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
