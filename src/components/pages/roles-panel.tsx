"use client";

import { Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, readApiData } from "@/lib/api";
import { toastApiError } from "@/lib/toast-api-error";
import { RoleBadge } from "@/components/role-badge";
import { Badge } from "@/components/ui/badge";
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

function extractRoles(data: unknown): Row[] {
  if (Array.isArray(data)) {
    return data.filter((x): x is Row => !!x && typeof x === "object");
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const list = o.roles ?? o.items ?? o.data;
    if (Array.isArray(list)) {
      return list.filter((x): x is Row => !!x && typeof x === "object");
    }
  }
  return [];
}

function roleName(r: Row): string {
  const n = r.name;
  return typeof n === "string" ? n : "—";
}

function roleDescription(r: Row): string {
  const d = r.description;
  return typeof d === "string" ? d : "—";
}

export function RolesPanel() {
  const t = useTranslations("RolesPage");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/roles", { method: "GET" });
      const data = await readApiData<unknown>(res);
      setRows(extractRoles(data));
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

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
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
                <Shield className="size-5" aria-hidden />
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
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">{t("colRole")}</TableHead>
                    <TableHead>{t("colDescription")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={(roleName(row) || "r") + idx}>
                      <TableCell>
                        <RoleBadge role={roleName(row)} />
                      </TableCell>
                      <TableCell className="max-w-xl text-sm text-muted-foreground">
                        {roleDescription(row)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
