"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  RefreshCw,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/lib/toast-api-error";
import { downloadCsvFile } from "@/lib/csv-download";
import {
  fetchNewsletterExport,
  fetchNewsletterPage,
  type NewsletterSubscriber,
} from "@/lib/newsletter-api";
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

const PAGE_SIZE = 20;

function formatWhen(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function subscribersToCsvRows(rows: NewsletterSubscriber[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    id: r.id ?? "",
    fullName: r.fullName ?? "",
    email: r.email,
    createdAt: r.createdAt ?? "",
    updatedAt: r.updatedAt ?? "",
  }));
}

export function NewsletterPanel() {
  const t = useTranslations("NewsletterPage");
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [bundle, setBundle] = useState<{
    rows: NewsletterSubscriber[];
    total: number;
    totalPages: number;
  }>({ rows: [], total: 0, totalPages: 1 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchNewsletterPage(page, PAGE_SIZE);
      setBundle({
        rows: result.rows,
        total: result.total,
        totalPages: result.totalPages,
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

  async function onExportCsv() {
    setExporting(true);
    try {
      const rows = await fetchNewsletterExport();
      if (rows.length === 0) {
        toast.info(t("exportEmpty"));
        return;
      }
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsvFile(`newsletter-subscribers-${stamp}.csv`, subscribersToCsvRows(rows));
      toast.success(t("exportSuccess", { count: rows.length }));
    } catch (e) {
      toastApiError(e, t("exportError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8">
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
                <Mail className="size-5" aria-hidden />
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
                {t("totalLabel")}: {loading ? "…" : bundle.total}
              </Badge>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {t("pageLabel")} {page} / {bundle.totalPages || 1}
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
              className="gap-1.5"
              disabled={loading}
              onClick={() => void load()}
            >
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              {t("refresh")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={exporting || loading}
              onClick={() => void onExportCsv()}
            >
              <Download
                className={cn("size-3.5", exporting && "animate-pulse")}
                aria-hidden
              />
              {exporting ? t("exporting") : t("exportCsv")}
            </Button>
            <div className="ms-auto flex flex-wrap items-center gap-2">
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
                  setPage((p) => Math.min(Math.max(1, bundle.totalPages), p + 1))
                }
                className="gap-1"
              >
                {t("next")}
                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : bundle.rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-16 text-center">
              <Mail className="size-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground">{t("empty")}</p>
              <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12 ps-6">{t("colIndex")}</TableHead>
                    <TableHead>{t("colFullName")}</TableHead>
                    <TableHead>{t("colEmail")}</TableHead>
                    <TableHead className="pe-6">{t("colSubscribed")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.rows.map((row, idx) => (
                    <TableRow key={row.id ?? `${row.email}-${idx}`}>
                      <TableCell className="ps-6 text-muted-foreground tabular-nums">
                        {(page - 1) * PAGE_SIZE + idx + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {row.fullName?.trim() ? row.fullName : "—"}
                      </TableCell>
                      <TableCell className="font-medium">{row.email}</TableCell>
                      <TableCell className="pe-6 text-sm text-muted-foreground">
                        {formatWhen(row.createdAt, locale)}
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
