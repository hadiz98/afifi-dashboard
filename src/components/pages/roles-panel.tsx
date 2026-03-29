"use client";

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
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit">
            {loading ? "…" : rows.length} {t("countLabel")}
          </Badge>
        </CardHeader>
        <CardContent>
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
