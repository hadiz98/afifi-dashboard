"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch, readApiData } from "@/lib/api";
import { toastApiError } from "@/lib/toast-api-error";
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

function extractSessions(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  }
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const list = o.sessions ?? o.items ?? o.data;
    if (Array.isArray(list)) {
      return list.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
    }
  }
  return [];
}

function cellId(row: Record<string, unknown>): string {
  const id = row.id ?? row.sessionId;
  return typeof id === "string" ? id : String(id ?? "");
}

function cellPreview(row: Record<string, unknown>): string {
  const keys = ["userAgent", "ip", "ipAddress", "createdAt", "expiresAt"];
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.length > 0) {
      return v.length > 80 ? `${v.slice(0, 80)}…` : v;
    }
  }
  return "—";
}

export function SessionsPanel() {
  const t = useTranslations("SessionsPage");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
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

  async function revoke(id: string) {
    if (!id) return;
    setRevoking(id);
    try {
      const res = await apiFetch(`/api/auth/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        await readApiData<unknown>(res);
      }
      toast.success(t("revoked"));
      await load();
    } catch (e) {
      toastApiError(e, t("revokeError"));
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0">
            {loading ? "…" : rows.length} {t("countLabel")}
          </Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
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
                    <TableHead className="w-[28%]">{t("colId")}</TableHead>
                    <TableHead>{t("colDetail")}</TableHead>
                    <TableHead className="w-[100px] text-end">
                      {t("colAction")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const id = cellId(row);
                    return (
                      <TableRow key={id || JSON.stringify(row)}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {id || "—"}
                        </TableCell>
                        <TableCell className="max-w-md truncate text-sm">
                          {cellPreview(row)}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="gap-1"
                            disabled={!id || revoking === id}
                            onClick={() => void revoke(id)}
                          >
                            <Trash2 className="size-3.5" />
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
