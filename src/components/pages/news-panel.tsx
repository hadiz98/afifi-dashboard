"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { toastApiError } from "@/lib/toast-api-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  ChevronRight,
  Calendar,
  ImageIcon,
  LayoutGrid,
  List,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  Upload,
  ChevronLeft,
} from "lucide-react";
import {
  createNews,
  type NewsItem,
} from "@/lib/news-api";
import { cn } from "@/lib/utils";
import {
  fetchNewsListPage,
  pickBestTranslation,
  type NewsLocale,
} from "@/lib/news-api";

/* ─── Types ──────────────────────────────────────────────────────── */

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

type ViewMode = "grid" | "list";

/* ─── Helpers ────────────────────────────────────────────────────── */

function emptyTranslations() {
  return {
    en: { title: "", subtitle: "", description: "", subDescription: "" },
    ar: { title: "", subtitle: "", description: "", subDescription: "" },
  };
}

function parseCommaTags(input: string): string[] {
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

function hasBothTranslationsRequired(
  tr: ReturnType<typeof emptyTranslations>,
  tagsByLocale: { en: string; ar: string }
): boolean {
  const locales: NewsLocale[] = ["en", "ar"];
  return locales.every((loc) => {
    const t = tr[loc];
    const tags = parseCommaTags(tagsByLocale[loc]);
    return t.title.trim().length > 0 && t.description.trim().length > 0 && tags.length > 0;
  });
}

const createNewsSchema = z.object({
  dateTime: z.date({ message: "required" }),
  imageFile: z
    .instanceof(File, { message: "required" })
    .refine((f) => f.size <= 5 * 1024 * 1024, { message: "maxSize" })
    .refine(
      (f) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type),
      { message: "badType" }
    ),
});

function validateCreate(values: { dateTime: Date | null; imageFile: File | null }) {
  const parsed = createNewsSchema.safeParse({
    dateTime: values.dateTime ?? undefined,
    imageFile: values.imageFile ?? undefined,
  });
  if (parsed.success) return { ok: true as const };
  const next: CreateFormErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (key === "dateTime") next.date = "required";
    if (key === "imageFile") next.image = issue.message;
  }
  return { ok: false as const, errors: next };
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

/* ─── Shared stat badge ─────────────────────────────────────────── */

function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/* ─── Status chip ───────────────────────────────────────────────── */

function StatusChip({ isActive }: { isActive?: boolean }) {
  const t = useTranslations("NewsPage");
  return isActive === false ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <XCircle className="size-3" />{t("statusInactive")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
      <CheckCircle2 className="size-3" />{t("statusActive")}
    </span>
  );
}

/* ─── Grid card ─────────────────────────────────────────────────── */

function NewsCardGrid({ row, locale, t }: { row: NewsItem; locale: string; t: ReturnType<typeof useTranslations> }) {
  const tr = pickBestTranslation(row, locale);
  const title = tr?.title ?? "—";
  const subtitle = tr?.subtitle ?? "";
  const tags = tr?.tags ?? [];

  return (
    <Link href={`/news/${encodeURIComponent(row.id)}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-44 overflow-hidden bg-muted">
        {row.image ? (
          <img src={row.image} alt={title} loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusChip isActive={row.isActive} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{title}</p>
          {subtitle && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{tag}</span>
            ))}
            {tags.length > 3 && (
              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">+{tags.length - 3}</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            {formatNewsDate(locale, row.date ?? row.createdAt)}
          </span>
          <span className="flex items-center gap-0.5 text-xs font-medium text-foreground group-hover:text-primary transition-colors">
            {t("view")} <ChevronRight className="size-3.5" />
          </span>
        </div>
      </div>
    </Link>
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
      setRows([]); setTotal(0); setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [page]);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const tr = pickBestTranslation(r, locale);
    const title = (tr?.title ?? "").toLowerCase();
    const subtitle = (tr?.subtitle ?? "").toLowerCase();
    return title.includes(search.toLowerCase()) || subtitle.includes(search.toLowerCase());
  });

  const validation = validateCreate({ dateTime: form.dateTime, imageFile });
  const submitDisabled = submitting || !validation.ok;

  async function onCreate() {
    const translationsOk = hasBothTranslationsRequired(form.translations, form.tagsByLocale);
    if (!validation.ok || !translationsOk) {
      const vErrors = !validation.ok ? validation.errors : {};
      setCreateErrors({
        ...(!translationsOk ? { title: t("translationsBothRequired") } : {}),
        ...(vErrors.date ? { date: `${t("fieldDate")} is required` } : {}),
        ...(vErrors.image ? {
          image: vErrors.image === "maxSize" ? t("imageMaxSize")
            : vErrors.image === "badType" ? t("imageBadType")
              : `${t("fieldImage")} is required`,
        } : {}),
      });
      return;
    }
    setCreateErrors((prev) => Object.keys(prev).length > 0 ? {} : prev);
    const fd = new FormData();
    fd.append("date", form.dateTime!.toISOString());
    fd.append("isActive", form.isActive ? "1" : "0");
    fd.append("image", imageFile!);
    const payload = (["en", "ar"] as const).reduce((acc, loc) => {
      const tt = form.translations[loc];
      acc[loc] = {
        title: tt.title.trim(), subtitle: tt.subtitle.trim(),
        description: tt.description.trim(), subDescription: tt.subDescription.trim(),
        tags: parseCommaTags(form.tagsByLocale[loc]),
      };
      return acc;
    }, {} as Record<string, unknown>);
    fd.append("translations", JSON.stringify(payload));
    setSubmitting(true);
    try {
      await createNews(fd);
      toast.success(t("createSuccess"));
      setCreateOpen(false); setCreateErrors({});
      setForm({ dateTime: null, isActive: true, translations: emptyTranslations(), tagsByLocale: { en: "", ar: "" } });
      setImageFile(null);
      await load();
    } catch (e) { toastApiError(e, t("createError")); }
    finally { setSubmitting(false); }
  }

  const activeCount = rows.filter((r) => r.isActive !== false).length;
  const inactiveCount = rows.filter((r) => r.isActive === false).length;

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
              <Newspaper className="size-4 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">{t("title")}</h1>
              <p className="text-xs text-muted-foreground">{t("description")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatBadge>{loading ? "…" : total} {t("countLabel")}</StatBadge>
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
              disabled={loading} onClick={() => void load()}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
            <Button type="button" size="sm" className="h-8 gap-1.5 text-xs"
              onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />{t("addNews")}
            </Button>
          </div>
        </div>

        {/* ── Stat pills ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("countLabel"), value: loading ? "…" : total },
            { label: t("statusActive"), value: activeCount },
            { label: t("statusInactive"), value: inactiveCount },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
              {loading ? (
                <Skeleton className="mt-1.5 h-6 w-8" />
              ) : (
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">{value}</p>
              )}
            </div>
          ))}
        </div>

        {/* ── List card ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">

          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t("searchPlaceholder")} value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm bg-background" />
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-background p-0.5">
                {(["list", "grid"] as ViewMode[]).map((mode) => (
                  <Tooltip key={mode}>
                    <TooltipTrigger
                      render={
                        <button type="button" onClick={() => setViewMode(mode)}
                          className={cn(
                            "rounded-md p-1.5 transition-all",
                            viewMode === mode ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}>
                          {mode === "list" ? <List className="size-3.5" /> : <LayoutGrid className="size-3.5" />}
                        </button>
                      }
                    />
                    <TooltipContent>{mode === "list" ? t("viewModeList") : t("viewModeGrid")}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            viewMode === "list" ? (
              <div className="divide-y divide-border/60">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-10 w-16 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-48" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-7 w-14 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-border/60">
                    <Skeleton className="h-44 w-full rounded-none" />
                    <div className="space-y-2 p-4">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filtered.length === 0 ? (
            <button type="button" onClick={() => !search && setCreateOpen(true)}
              className={cn("flex w-full flex-col items-center gap-3 py-20 text-center", !search && "transition-colors hover:bg-muted/20")}>
              <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted shadow-sm">
                <FileText className="size-5 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {search ? "No results found" : t("empty")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {search ? `No articles match "${search}"` : "Create your first news article to get started."}
                </p>
              </div>
              {!search && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
                  <Plus className="size-3" />{t("addNews")}
                </span>
              )}
            </button>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((row) => (
                <NewsCardGrid key={row.id} row={row} locale={locale} t={t} />
              ))}
            </div>
          ) : (
            /* ── Mobile cards + desktop table ── */
            <>
              {/* Mobile */}
              <div className="divide-y divide-border/60 sm:hidden">
                {filtered.map((row) => {
                  const tr = pickBestTranslation(row, locale);
                  const title = tr?.title?.trim() ? tr.title : "—";
                  const subtitle = tr?.subtitle ?? "";
                  return (
                    <Link key={row.id} href={`/news/${encodeURIComponent(row.id)}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 active:bg-muted/50">
                      <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                        {row.image ? (
                          <img src={row.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ImageIcon className="size-3.5 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusChip isActive={row.isActive} />
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="size-2.5" />
                            {formatNewsDate(locale, row.date ?? row.createdAt)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground/40 shrink-0 rtl:rotate-180" />
                    </Link>
                  );
                })}
              </div>

              {/* Desktop */}
              <div className="hidden sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[40%]">{t("colTitle")}</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colStatus")}</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colDate")}</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colTags")}</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colAction")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filtered.map((row) => {
                      const tr = pickBestTranslation(row, locale);
                      const title = tr?.title?.trim() ? tr.title : "—";
                      const subtitle = tr?.subtitle ?? "";
                      const tags = tr?.tags ?? [];
                      return (
                        <tr key={row.id} className="group transition-colors hover:bg-muted/30">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                                {row.image ? (
                                  <img src={row.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full items-center justify-center">
                                    <ImageIcon className="size-3.5 text-muted-foreground/30" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{title}</p>
                                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><StatusChip isActive={row.isActive} /></td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <Calendar className="size-3 shrink-0" />
                              {formatNewsDate(locale, row.date ?? row.createdAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {tags.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {tags.slice(0, 2).map((tag) => (
                                  <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{tag}</span>
                                ))}
                                {tags.length > 2 && (
                                  <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] text-muted-foreground">+{tags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button variant="outline" size="sm" className="h-7 gap-1.5 px-3 text-xs"
                              nativeButton={false}
                              render={
                                <Link href={`/news/${encodeURIComponent(row.id)}`}>
                                  {t("view")}<ChevronRight className="size-3.5 rtl:rotate-180" />
                                </Link>
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination footer */}
          {!loading && rows.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                {t("pageLabel")} <span className="font-medium text-foreground">{page}</span> / <span className="font-medium text-foreground">{totalPages}</span>
              </p>
              <div className="flex items-center gap-1.5">
                <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0"
                  disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="size-3.5 rtl:rotate-180" />
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0"
                  disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  <ChevronRight className="size-3.5 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Create dialog ══════════════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92dvh] overflow-hidden flex flex-col sm:max-w-[600px]">
          <DialogHeader className="shrink-0 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <Newspaper className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogCreateTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogCreateDescription")}</DialogDescription>
          </DialogHeader>

          <Separator className="shrink-0" />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-5 py-4 pr-1">
              {createErrors.title && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{createErrors.title}</p>
              )}

              {/* Translations */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("translationsLabel")}</p>
                  <Badge variant="secondary" className="text-xs">{t("required")}</Badge>
                </div>

                {(["en", "ar"] as const).map((loc) => {
                  const dir = loc === "ar" ? "rtl" : "ltr";
                  const v = form.translations[loc];
                  return (
                    <div key={loc} className="rounded-xl border border-border/60 bg-background p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">{loc === "en" ? t("langEn") : t("langAr")}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{loc}</span>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { key: "title" as const, label: t("fieldTitle"), type: "input" },
                          { key: "subtitle" as const, label: t("fieldSubtitle"), type: "input" },
                          { key: "description" as const, label: t("fieldDescription"), type: "textarea", rows: 2 },
                          { key: "subDescription" as const, label: t("fieldSubDescription"), type: "textarea", rows: 2 },
                        ].map(({ key, label, type, rows }) => (
                          <div key={key} className="grid gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</Label>
                            {type === "textarea" ? (
                              <Textarea dir={dir} rows={rows} value={v[key]} className="resize-none text-sm"
                                onChange={(e) => setForm((s) => ({ ...s, translations: { ...s.translations, [loc]: { ...s.translations[loc], [key]: e.target.value } } }))} />
                            ) : (
                              <Input dir={dir} value={v[key]} className="h-9"
                                onChange={(e) => setForm((s) => ({ ...s, translations: { ...s.translations, [loc]: { ...s.translations[loc], [key]: e.target.value } } }))} />
                            )}
                          </div>
                        ))}
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldTags")}</Label>
                          <Input dir={dir} value={form.tagsByLocale[loc]} className="h-9"
                            placeholder={loc === "en" ? "sport, news, event" : "رياضة، أخبار"}
                            onChange={(e) => setForm((s) => ({ ...s, tagsByLocale: { ...s.tagsByLocale, [loc]: e.target.value } }))} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Date picker */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("fieldDate")}</Label>
                <NewsDateTimePicker
                  value={form.dateTime}
                  required
                  onChange={(next) => { setForm((s) => ({ ...s, dateTime: next })); setCreateErrors((e) => ({ ...e, date: undefined })); }}
                  error={createErrors.date}
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3">
                <div>
                  <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                  <p className="text-xs text-muted-foreground">{form.isActive ? t("statusActive") : t("statusInactive")}</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
              </div>

              {/* Image upload */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("fieldImage")} <span className="text-destructive normal-case">*</span>
                </Label>
                <label htmlFor="news-image"
                  className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-background py-8 text-center transition-colors hover:border-border hover:bg-muted/30">
                  <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted shadow-sm transition-colors group-hover:bg-background">
                    {imageFile ? <ImageIcon className="size-5 text-foreground" /> : <Upload className="size-5 text-muted-foreground" />}
                  </div>
                  {imageFile ? (
                    <div>
                      <p className="text-sm font-medium">{imageFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(imageFile.size / 1024).toFixed(1)} KB · {t("clickToReplace")}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">{t("clickToUpload")}</p>
                      <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5 MB</p>
                    </div>
                  )}
                  <Input id="news-image" type="file" accept="image/*" className="sr-only"
                    onChange={(e) => { setImageFile(e.target.files?.[0] ?? null); setCreateErrors((er) => ({ ...er, image: undefined })); }} />
                </label>
                {createErrors.image && (
                  <p className="text-xs text-destructive">{createErrors.image}</p>
                )}
              </div>
            </div>
          </div>

          <Separator className="shrink-0" />

          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button variant="outline" disabled={submitting} onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button disabled={submitDisabled} onClick={() => void onCreate()} className="gap-1.5 min-w-24">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}