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
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

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
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <Mail className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatBadge>
            {t("totalLabel")}: {loading ? "…" : bundle.total}
          </StatBadge>
          <StatBadge>
            {t("pageLabel")} {page} / {bundle.totalPages || 1}
          </StatBadge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={loading}
            onClick={() => void load()}
            aria-label={t("refresh")}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={exporting || loading}
            onClick={() => void onExportCsv()}
          >
            <Download className={cn("size-3.5", exporting && "animate-pulse")} />
            {exporting ? t("exporting") : t("exportCsv")}
          </Button>
        </div>
      </div>

      {/* ── List card ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {loading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-10 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-4 w-28 shrink-0" />
              </div>
            ))}
          </div>
        ) : bundle.rows.length === 0 ? (
          <div className="m-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/10 py-20 text-center">
            <Mail className="size-10 text-muted-foreground/40" aria-hidden />
            <p className="text-sm font-semibold text-foreground">{t("empty")}</p>
            <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-transparent">
                <TableHead className="w-12 ps-6 text-start">{t("colIndex")}</TableHead>
                <TableHead className="text-start">{t("colFullName")}</TableHead>
                <TableHead className="text-start">{t("colEmail")}</TableHead>
                <TableHead className="pe-6 text-end">{t("colSubscribed")}</TableHead>
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
                  <TableCell className="pe-6 text-end text-sm text-muted-foreground">
                    {formatWhen(row.createdAt, locale)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && bundle.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t("pageLabel")} {page} / {bundle.totalPages}
            </p>
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
                onClick={() =>
                  setPage((p) => Math.min(Math.max(1, bundle.totalPages), p + 1))
                }
              >
                {t("next")}
                <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
