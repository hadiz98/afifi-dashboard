"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { toastApiError } from "@/lib/toast-api-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { NewsDateTimePicker } from "@/components/news-date-time-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import {
  RefreshCw,
  Plus,
  Newspaper,
  ArrowUpRight,
  Calendar,
  Tag,
  ImageIcon,
  LayoutGrid,
  List,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  Text,
  Upload,
} from "lucide-react";
import {
  createNews,
  normalizeNewsItem,
  type NewsItem,
} from "@/lib/news-api";
import { cn } from "@/lib/utils";
import {
  fetchNewsListPage,
  pickBestTranslation,
  type NewsLocale,
} from "@/lib/news-api";

/* ─── Types ─────────────────────────────────────────────────────── */

type NewsFormState = {
  dateTime: Date | null;
  isActive: boolean;
  translations: {
    en: { title: string; subtitle: string; description: string; subDescription: string };
    ar: { title: string; subtitle: string; description: string; subDescription: string };
  };
  tagsByLocale: { en: string; ar: string };
};

type CreateFormErrors = Partial<
  Record<"title" | "description" | "date" | "tags" | "image", string>
>;

function emptyTranslations() {
  return {
    en: { title: "", subtitle: "", description: "", subDescription: "" },
    ar: { title: "", subtitle: "", description: "", subDescription: "" },
  };
}

function hasBothTranslationsRequired(
  tr: ReturnType<typeof emptyTranslations>,
  tagsByLocale: { en: string; ar: string }
): boolean {
  const locales: NewsLocale[] = ["en", "ar"];
  return locales.every((loc) => {
    const t = tr[loc];
    const tags = parseCommaTags(tagsByLocale[loc]);
    return (
      t.title.trim().length > 0 &&
      t.description.trim().length > 0 &&
      tags.length > 0
    );
  });
}

const createNewsSchema = z.object({
  dateTime: z.date({ message: "required" }),
  imageFile: z
    .instanceof(File, { message: "required" })
    .refine((f) => f.size <= 5 * 1024 * 1024, { message: "maxSize" })
    .refine(
      (f) =>
        ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type),
      { message: "badType" }
    ),
});

function validateCreate(values: {
  dateTime: Date | null;
  imageFile: File | null;
}): { ok: true } | { ok: false; errors: CreateFormErrors } {
  const parsed = createNewsSchema.safeParse({
    dateTime: values.dateTime ?? undefined,
    imageFile: values.imageFile ?? undefined,
  });

  if (parsed.success) return { ok: true };

  const next: CreateFormErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (key === "dateTime") next.date = "required";
    if (key === "imageFile") next.image = issue.message;
  }
  return { ok: false, errors: next };
}

type ViewMode = "grid" | "list";

/* ─── Helpers ────────────────────────────────────────────────────── */

// list parsing moved to `fetchNewsListPage` (pagination meta aware)

function parseCommaTags(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatNewsDate(locale: string, value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
  } catch {
    return d.toISOString();
  }
}

/* ─── Stat Card ──────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-1.5 h-7 w-10" />
      ) : (
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
          {value}
        </p>
      )}
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────────── */

function StatusBadge({ isActive }: { isActive?: boolean }) {
  const t = useTranslations("NewsPage");
  return isActive === false ? (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-destructive/30 bg-destructive/10 text-destructive",
        "dark:border-destructive/40 dark:bg-destructive/20"
      )}
    >
      <XCircle className="size-3" />
      {t("statusInactive")}
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
        "dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-300"
      )}
    >
      <CheckCircle2 className="size-3" />
      {t("statusActive")}
    </Badge>
  );
}

/* ─── Grid Card ──────────────────────────────────────────────────── */

function NewsCardGrid({
  row,
  locale,
  t,
}: {
  row: NewsItem;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const tr = pickBestTranslation(row, locale);
  const title = tr?.title ?? "—";
  const subtitle = tr?.subtitle ?? "";
  const tags = tr?.tags ?? [];
  return (
    <Card className="group flex flex-col overflow-hidden border shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-40 w-full overflow-hidden bg-muted">
        {row.image ? (
          <img
            src={row.image}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5">
          <StatusBadge isActive={row.isActive} />
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs font-normal">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            {formatNewsDate(locale, row.date ?? row.createdAt)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            nativeButton={false}
            render={
              <Link href={`/news/${encodeURIComponent(row.id)}`}>
                {t("view")}
                <ArrowUpRight className="size-3" />
              </Link>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Panel ─────────────────────────────────────────────────── */

export function NewsPanel() {
  const t = useTranslations("NewsPage");
  const locale = useLocale();

  const [rows, setRows] = useState<NewsItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createErrors, setCreateErrors] = useState<CreateFormErrors>({});
  const [form, setForm] = useState<NewsFormState>({
    dateTime: null,
    isActive: true,
    translations: emptyTranslations(),
    tagsByLocale: { en: "", ar: "" },
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    try {
      const result = await fetchNewsListPage({ page, limit: 20 });
      setRows(result.rows);
      setTotal(result.meta.total);
      setTotalPages(result.meta.pages);
    } catch (e) {
      toastApiError(e, t("loadError"));
      setRows([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const tr = pickBestTranslation(r, locale);
    const title = (tr?.title ?? "").toLowerCase();
    const subtitle = (tr?.subtitle ?? "").toLowerCase();
    return (
      title.includes(search.toLowerCase()) || subtitle.includes(search.toLowerCase())
    );
  });

  const validation = validateCreate({
    dateTime: form.dateTime,
    imageFile,
  });

  const submitDisabled = submitting || validation.ok === false;

  async function onCreate() {
    const translationsOk = hasBothTranslationsRequired(form.translations, form.tagsByLocale);
    if (validation.ok === false || !translationsOk) {
      const vErrors = validation.ok === false ? validation.errors : {};
      setCreateErrors({
        ...(!translationsOk ? { title: t("translationsBothRequired") } : {}),
        ...(vErrors.date ? { date: `${t("fieldDate")} is required` } : {}),
        ...(vErrors.image
          ? {
              image:
                vErrors.image === "maxSize"
                  ? t("imageMaxSize")
                  : vErrors.image === "badType"
                    ? t("imageBadType")
                    : `${t("fieldImage")} is required`,
            }
          : {}),
      });
      return;
    }

    setCreateErrors((prev) =>
      Object.keys(prev).length > 0 ? {} : prev
    );

    const fd = new FormData();
    fd.append("date", form.dateTime!.toISOString());
    // Backend accepts boolean-like: true/false/1/0 — use 1/0 for consistency.
    fd.append("isActive", form.isActive ? "1" : "0");
    fd.append("image", imageFile!);
    const payload: Record<string, unknown> = (["en", "ar"] as const).reduce(
      (acc, loc) => {
        const tt = form.translations[loc];
        const tags = parseCommaTags(form.tagsByLocale[loc]);
        acc[loc] = {
          title: tt.title.trim(),
          subtitle: tt.subtitle.trim(),
          description: tt.description.trim(),
          subDescription: tt.subDescription.trim(),
          tags,
        };
        return acc;
      },
      {} as Record<string, unknown>
    );
    fd.append("translations", JSON.stringify(payload));

    setSubmitting(true);
    try {
      await createNews(fd);
      toast.success(t("createSuccess"));
      setCreateOpen(false);
      setCreateErrors({});
      setForm({
        dateTime: null,
        isActive: true,
        translations: emptyTranslations(),
        tagsByLocale: { en: "", ar: "" },
      });
      setImageFile(null);
      await load();
    } catch (e) {
      toastApiError(e, t("createError"));
    } finally {
      setSubmitting(false);
    }
  }

  const activeCount = rows.filter((r) => r.isActive !== false).length;
  const inactiveCount = rows.filter((r) => r.isActive === false).length;

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">

          {/* ── Page Header ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card shadow-sm">
                <Newspaper className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  {t("title")}
                </h1>
                <p className="text-sm text-muted-foreground">{t("description")}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw
                  className={`size-3.5 ${loading ? "animate-spin" : ""}`}
                />
                {t("refresh")}
              </Button>

              <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" />
                {t("addNews")}
              </Button>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label={t("countLabel")} value={loading ? "…" : total} loading={loading} />
            <StatCard label={t("statusActive")} value={activeCount} loading={loading} />
            <StatCard label={t("statusInactive")} value={inactiveCount} loading={loading} />
          </div>

          {/* ── Main Card ── */}
          <Card className="overflow-hidden border shadow-sm">
            {/* Toolbar */}
            <CardHeader className="border-b bg-card px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Pagination */}
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="hidden text-xs font-normal text-muted-foreground sm:inline-flex"
                    >
                      {t("pageLabel")} {page} / {totalPages}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={loading || page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t("prev")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={loading || page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      {t("next")}
                    </Button>
                  </div>

                  {/* View mode toggle */}
                  <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5">
                    {(["list", "grid"] as ViewMode[]).map((mode) => (
                      <Tooltip key={mode}>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              onClick={() => setViewMode(mode)}
                              className={cn(
                                "rounded px-2 py-1 transition-all",
                                viewMode === mode
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {mode === "list" ? (
                                <List className="size-4" />
                              ) : (
                                <LayoutGrid className="size-4" />
                              )}
                            </button>
                          }
                        />
                        <TooltipContent>
                          {mode === "list" ? t("viewModeList") : t("viewModeGrid")}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* ── Loading ── */}
              {loading ? (
                viewMode === "list" ? (
                  <div className="divide-y">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 px-6 py-4">
                        <Skeleton className="h-9 w-14 rounded-md" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-52" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-14 rounded-md" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="overflow-hidden rounded-lg border">
                        <Skeleton className="h-40 w-full rounded-none" />
                        <div className="space-y-2 p-4">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : filtered.length === 0 ? (
                /* ── Empty state ── */
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted/50">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {search ? "No results found" : t("empty")}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {search
                        ? `No articles match "${search}"`
                        : "Create your first news article to get started."}
                    </p>
                  </div>
                  {!search && (
                    <Button
                      size="sm"
                      className="mt-1 gap-1.5"
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus className="size-3.5" />
                      {t("addNews")}
                    </Button>
                  )}
                </div>
              ) : viewMode === "grid" ? (
                /* ── Grid ── */
                <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((row) => (
                    <NewsCardGrid key={row.id} row={row} locale={locale} t={t} />
                  ))}
                </div>
              ) : (
                /* ── Table ── */
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6 w-[38%]">{t("colTitle")}</TableHead>
                      <TableHead>{t("colStatus")}</TableHead>
                      <TableHead>{t("colDate")}</TableHead>
                      <TableHead>{t("colTags")}</TableHead>
                      <TableHead className="pr-6 w-px text-right">
                        {t("colAction")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row.id} className="group">
                        {/* Title */}
                        <TableCell className="pl-6">
                          {(() => {
                            const tr = pickBestTranslation(row, locale);
                            const title = (tr?.title?.trim() ? tr.title : "—");
                            const subtitle = tr?.subtitle ?? "";
                            const tags = tr?.tags ?? [];
                            return (
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                              {row.image ? (
                                <img
                                  src={row.image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <ImageIcon className="size-3.5 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {title}
                              </p>
                              {subtitle ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {subtitle}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          );
                          })()}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <StatusBadge isActive={row.isActive} />
                        </TableCell>

                        {/* Date */}
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="size-3 shrink-0" />
                            {formatNewsDate(locale, row.date ?? row.createdAt)}
                          </span>
                        </TableCell>

                        {/* Tags */}
                        <TableCell>
                          {(() => {
                            const tr = pickBestTranslation(row, locale);
                            const tags = tr?.tags ?? [];
                            if (tags.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
                            return (
                              <div className="flex flex-wrap gap-1">
                                {tags.slice(0, 3).map((tag) => (
                                  <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="text-xs font-normal"
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                                {tags.length > 3 && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs text-muted-foreground"
                                  >
                                    +{tags.length - 3}
                                  </Badge>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="pr-6 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            nativeButton={false}
                            render={
                              <Link href={`/news/${encodeURIComponent(row.id)}`}>
                                {t("view")}
                                <ArrowUpRight className="size-3" />
                              </Link>
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Newspaper className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {t("dialogCreateTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("dialogCreateDescription")}
            </DialogDescription>
          </DialogHeader>

          <Separator />

          <div className="grid max-h-[58vh] gap-3.5 overflow-y-auto py-1 pr-1">
            {createErrors.title ? (
              <p className="text-xs text-destructive">{createErrors.title}</p>
            ) : null}

            {/* Translations + tags (required) */}
            <div className="grid gap-2 rounded-lg border bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("translationsLabel")}
                </p>
                <Badge variant="secondary" className="text-xs font-normal">
                  {t("required")}
                </Badge>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {/* EN */}
                <div className="grid gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{t("langEn")}</p>
                  <Input
                    value={form.translations.en.title}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          en: { ...s.translations.en, title: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${t("fieldTitle")} (${t("langEn")})`}
                    className="h-8 text-sm"
                  />
                  <Input
                    value={form.translations.en.subtitle}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          en: { ...s.translations.en, subtitle: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${t("fieldSubtitle")} (${t("langEn")})`}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    rows={2}
                    value={form.translations.en.description}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          en: { ...s.translations.en, description: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${t("fieldDescription")} (${t("langEn")})`}
                    className="resize-none text-sm"
                  />
                  <Textarea
                    rows={2}
                    value={form.translations.en.subDescription}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          en: { ...s.translations.en, subDescription: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${t("fieldSubDescription")} (${t("langEn")})`}
                    className="resize-none text-sm"
                  />
                  <Input
                    value={form.tagsByLocale.en}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        tagsByLocale: { ...s.tagsByLocale, en: e.target.value },
                      }))
                    }
                    placeholder={`${t("fieldTags")} (${t("langEn")})`}
                    className="h-8 text-sm"
                  />
                </div>

                {/* AR */}
                <div className="grid gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{t("langAr")}</p>
                  <Input
                    dir="rtl"
                    value={form.translations.ar.title}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          ar: { ...s.translations.ar, title: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${t("fieldTitle")} (${t("langAr")})`}
                    className="h-8 text-sm"
                  />
                  <Input
                    dir="rtl"
                    value={form.translations.ar.subtitle}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          ar: { ...s.translations.ar, subtitle: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${t("fieldSubtitle")} (${t("langAr")})`}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    dir="rtl"
                    rows={2}
                    value={form.translations.ar.description}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          ar: { ...s.translations.ar, description: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${t("fieldDescription")} (${t("langAr")})`}
                    className="resize-none text-sm"
                  />
                  <Textarea
                    dir="rtl"
                    rows={2}
                    value={form.translations.ar.subDescription}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          ar: { ...s.translations.ar, subDescription: e.target.value },
                        },
                      }))
                    }
                    placeholder={`${t("fieldSubDescription")} (${t("langAr")})`}
                    className="resize-none text-sm"
                  />
                  <Input
                    dir="rtl"
                    value={form.tagsByLocale.ar}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        tagsByLocale: { ...s.tagsByLocale, ar: e.target.value },
                      }))
                    }
                    placeholder={`${t("fieldTags")} (${t("langAr")})`}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <NewsDateTimePicker
              value={form.dateTime}
              required={true}
              onChange={(next) => {
                setForm((s) => ({ ...s, dateTime: next }));
                setCreateErrors((e) => ({ ...e, date: undefined }));
              }}
              error={createErrors.date}
            />

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="news-isActive"
                  className="cursor-pointer text-sm font-medium"
                >
                  {t("fieldIsActive")}
                </Label>
                <StatusBadge isActive={form.isActive} />
              </div>
              <Switch
                id="news-isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
              />
            </div>

            {/* Image upload */}
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <ImageIcon className="size-3 text-muted-foreground" aria-hidden />
                {t("fieldImage")} <span className="text-destructive">*</span>
              </Label>
              <label
                htmlFor="news-image"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/10 py-8 text-center transition-colors hover:bg-muted/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm">
                  {imageFile ? (
                    <ImageIcon className="size-4 text-foreground" />
                  ) : (
                    <Upload className="size-4 text-muted-foreground" />
                  )}
                </div>
                {imageFile ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {imageFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(imageFile.size / 1024).toFixed(1)} KB · click to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Click to upload
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, WEBP up to 10 MB
                    </p>
                  </div>
                )}
                <Input
                  id="news-image"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    setImageFile(e.target.files?.[0] ?? null);
                    setCreateErrors((er) => ({ ...er, image: undefined }));
                  }}
                />
              </label>
              {createErrors.image ? (
                <p className="text-xs text-destructive">{createErrors.image}</p>
              ) : null}
            </div>
          </div>

          <Separator />

          <DialogFooter className="gap-2 pt-1 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => void onCreate()}
              disabled={submitDisabled}
              className="gap-1.5"
            >
              {submitting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}