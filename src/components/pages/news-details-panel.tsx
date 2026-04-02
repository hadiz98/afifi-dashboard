"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Newspaper,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { toastApiError } from "@/lib/toast-api-error";
import { deleteNews, deleteNewsImage, fetchNewsById, updateNews, type NewsItem } from "@/lib/news-api";
import {
  anyNewsFullContentOverLimit,
  buildNewsTranslationsPayload,
  hasAtLeastOneNewsLocale,
  type NewsLocaleFormRow,
} from "@/lib/news-form-helpers";
import { META_DESCRIPTION_MAX_LENGTH, META_TITLE_MAX_LENGTH } from "@/lib/full-content-constants";
import { NewsDateTimePicker } from "@/components/news-date-time-picker";
import { RichTextHtmlEditor } from "@/components/rich-text/rich-text-html-editor";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { RequiredStar } from "@/components/ui/required-star";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  description,
  badge,
  actions,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background shadow-sm">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              {badge}
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Info field ───────────────────────────────────────────────────────────────
function InfoField({
  label,
  value,
  dir,
}: {
  label: string;
  value?: string | null;
  dir?: string;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground" dir={dir}>
        {value ?? "—"}
      </p>
    </div>
  );
}

// ─── Types & helpers ──────────────────────────────────────────────────────────
type Locale = "en" | "ar";
type TranslationsForm = Record<Locale, NewsLocaleFormRow & { tags: string }>;

function emptyTranslations(): TranslationsForm {
  const row = {
    title: "",
    subtitle: "",
    fullContent: "",
    metaTitle: "",
    metaDescription: "",
    tags: "",
  };
  return { en: { ...row }, ar: { ...row } };
}

function translationsFromItem(item: NewsItem): TranslationsForm {
  const base = emptyTranslations();
  for (const tr of item.translations ?? []) {
    if (tr.locale !== "en" && tr.locale !== "ar") continue;
    const fc = typeof tr.fullContent === "string" ? tr.fullContent : "";
    base[tr.locale] = {
      title: tr.title ?? "",
      subtitle: tr.subtitle ?? "",
      fullContent: fc,
      metaTitle: tr.metaTitle ?? "",
      metaDescription: tr.metaDescription ?? "",
      tags: (tr.tags ?? []).join(", "),
    };
  }
  return base;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function NewsDetailsPanel({ id }: { id: string }) {
  const t = useTranslations("NewsDetailsPage");
  const tCommon = useTranslations("NewsPage");
  const locale = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeImageOpen, setRemoveImageOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    dateTime: Date | null;
    isActive: boolean;
    translations: TranslationsForm;
  }>({
    dateTime: null,
    isActive: true,
    translations: emptyTranslations(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const item = await fetchNewsById(id);
      setNews(item);
      setImageFile(null);
      const d = item.date ? new Date(item.date) : null;
      setForm({
        dateTime: d && !Number.isNaN(d.getTime()) ? d : null,
        isActive: item.isActive !== false,
        translations: translationsFromItem(item),
      });
    } catch (e) {
      toastApiError(e, t("loadError"));
      setNews(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { void load(); }, [load]);

  function formatDate(value?: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
    } catch {
      return d.toISOString();
    }
  }

  const saveDisabled = useMemo(() => {
    if (submitting) return true;
    const tagsBy = { en: form.translations.en.tags, ar: form.translations.ar.tags };
    const core: Record<Locale, NewsLocaleFormRow> = {
      en: {
        title: form.translations.en.title,
        subtitle: form.translations.en.subtitle,
        fullContent: form.translations.en.fullContent,
        metaTitle: form.translations.en.metaTitle,
        metaDescription: form.translations.en.metaDescription,
      },
      ar: {
        title: form.translations.ar.title,
        subtitle: form.translations.ar.subtitle,
        fullContent: form.translations.ar.fullContent,
        metaTitle: form.translations.ar.metaTitle,
        metaDescription: form.translations.ar.metaDescription,
      },
    };
    return (
      !hasAtLeastOneNewsLocale(
        {
          en: { title: core.en.title, fullContent: core.en.fullContent },
          ar: { title: core.ar.title, fullContent: core.ar.fullContent },
        },
        tagsBy
      ) || anyNewsFullContentOverLimit(core)
    );
  }, [form.translations, submitting]);

  async function onSave() {
    setFormError(null);
    const tagsBy = { en: form.translations.en.tags, ar: form.translations.ar.tags };
    const core: Record<Locale, NewsLocaleFormRow> = {
      en: {
        title: form.translations.en.title,
        subtitle: form.translations.en.subtitle,
        fullContent: form.translations.en.fullContent,
        metaTitle: form.translations.en.metaTitle,
        metaDescription: form.translations.en.metaDescription,
      },
      ar: {
        title: form.translations.ar.title,
        subtitle: form.translations.ar.subtitle,
        fullContent: form.translations.ar.fullContent,
        metaTitle: form.translations.ar.metaTitle,
        metaDescription: form.translations.ar.metaDescription,
      },
    };
    if (!hasAtLeastOneNewsLocale(
      {
        en: { title: core.en.title, fullContent: core.en.fullContent },
        ar: { title: core.ar.title, fullContent: core.ar.fullContent },
      },
      tagsBy
    )) {
      setFormError(tCommon("translationsAtLeastOneRequired"));
      return;
    }
    if (anyNewsFullContentOverLimit(core)) {
      setFormError(tCommon("fullContentMax"));
      return;
    }
    const payload = buildNewsTranslationsPayload(core, tagsBy);
    if (Object.keys(payload).length === 0) {
      setFormError(tCommon("translationsAtLeastOneRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      if (form.dateTime) fd.append("date", form.dateTime.toISOString());
      fd.append("isActive", form.isActive ? "1" : "0");
      if (imageFile) fd.append("image", imageFile);
      fd.append("translations", JSON.stringify(payload));
      await updateNews(id, fd);
      toast.success(tCommon("updateSuccess"));
      setEditOpen(false);
      setImageFile(null);
      await load();
    } catch (e) {
      toastApiError(e, tCommon("updateError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    setSubmitting(true);
    try {
      await deleteNews(id);
      toast.success(t("deleteSuccess"));
      setDeleteOpen(false);
      router.replace("/news");
    } catch (e) {
      toastApiError(e, t("deleteError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemoveImage() {
    setSubmitting(true);
    try {
      await deleteNewsImage(id);
      toast.success(t("removeImageSuccess"));
      setRemoveImageOpen(false);
      await load();
    } catch (e) {
      toastApiError(e, t("removeImageError"));
    } finally {
      setSubmitting(false);
    }
  }

  const bestTitle = (() => {
    if (!news) return "—";
    const want = locale === "ar" ? "ar" : "en";
    const tr =
      news.translations?.find((x) => x.locale === want) ??
      news.translations?.[0];
    return tr?.title?.trim() ? tr.title : "—";
  })();

  const supported = new Set((news?.translations ?? []).map((x) => x.locale));
  const image = news?.image?.trim() ? news.image : null;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-28" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <Skeleton className="h-48 w-full sm:h-56" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="border-b border-border/60 bg-muted/30 px-4 py-3">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!news) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-20 text-center">
          <Newspaper className="mx-auto size-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium">{t("empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ms-2 gap-1.5 text-muted-foreground hover:text-foreground"
          nativeButton={false}
          render={
            <Link href="/news">
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {t("back")}
            </Link>
          }
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" />
            <span className="hidden sm:inline">{t("edit")}</span>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            <span className="hidden sm:inline">{t("delete")}</span>
          </Button>
        </div>
      </div>

      {/* ── Hero card ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {/* Image banner */}
        <div className="relative h-44 bg-muted sm:h-56">
          {image ? (
            <img
              src={image}
              alt={bestTitle}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="size-10 text-muted-foreground/20" />
            </div>
          )}
          {/* Status pill overlay */}
          <div className="absolute right-3 top-3 flex gap-2">
            {news.isActive !== false ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />
                {tCommon("statusActive")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <XCircle className="size-3" />
                {tCommon("statusInactive")}
              </span>
            )}

            {image ? (
              <button
                type="button"
                onClick={() => setRemoveImageOpen(true)}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <X className="size-3" aria-hidden />
                {t("removeImage")}
              </button>
            ) : null}
          </div>
        </div>

        {/* Identity */}
        <div className="border-b border-border/60 px-4 py-4 sm:px-5">
          <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {bestTitle}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="size-3" />
              {formatDate(news.date)}
            </span>
            {(["en", "ar"] as const).map((loc) => (
              <Badge
                key={loc}
                variant={supported.has(loc) ? "secondary" : "outline"}
                className={cn(
                  "rounded-full px-2 py-0 text-[10px] font-semibold uppercase",
                  !supported.has(loc) && "text-muted-foreground",
                )}
              >
                {loc}
              </Badge>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 divide-x divide-border/60">
          {[
            {
              icon: CalendarDays,
              label: tCommon("fieldDate"),
              value: formatDate(news.date),
            },
            {
              icon: CheckCircle2,
              label: tCommon("fieldIsActive"),
              value:
                news.isActive !== false
                  ? tCommon("statusActive")
                  : tCommon("statusInactive"),
            },
            {
              icon: Globe,
              label: t("translationsLabel"),
              value: `${supported.size} / 2`,
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2.5 px-4 py-3">
              <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                  {label}
                </p>
                <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                  {value ?? "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Translations section ─────────────────────────────────────────── */}
      <Section
        icon={Globe}
        title={t("translationsLabel")}
        badge={
          <div className="flex gap-1">
            {(["en", "ar"] as const).map((loc) => (
              <span
                key={loc}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  supported.has(loc)
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {loc}
              </span>
            ))}
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {(["en", "ar"] as const).map((loc) => {
            const tr = news.translations?.find((x) => x.locale === loc) ?? null;
            const dir = loc === "ar" ? "rtl" : "ltr";
            return (
              <div
                key={loc}
                className="rounded-xl border border-border/60 bg-background p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {loc === "en" ? tCommon("langEn") : tCommon("langAr")}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      tr
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {loc}
                  </span>
                </div>
                <div className="space-y-3" dir={dir}>
                  <InfoField
                    label={tCommon("fieldTitle")}
                    value={tr?.title?.trim() ? tr.title : undefined}
                    dir={dir}
                  />
                  <InfoField
                    label={tCommon("fieldSubtitle")}
                    value={tr?.subtitle?.trim() ? tr.subtitle : undefined}
                    dir={dir}
                  />
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      {tCommon("fieldFullContent")}
                    </p>
                    {tr?.fullContent?.trim() ? (
                      <div
                        className="max-w-none text-sm text-foreground [&_a]:text-primary [&_a]:underline [&_h1]:text-base [&_h2]:text-sm [&_li]:my-0.5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:ps-4"
                        dir={dir}
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(tr.fullContent, { USE_PROFILES: { html: true } }),
                        }}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                  </div>
                  {(tr?.metaTitle?.trim() || tr?.metaDescription?.trim()) ? (
                    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/15 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {tCommon("seoSection")}
                      </p>
                      <InfoField
                        label={tCommon("fieldMetaTitle")}
                        value={tr?.metaTitle?.trim() || undefined}
                        dir={dir}
                      />
                      <InfoField
                        label={tCommon("fieldMetaDescription")}
                        value={tr?.metaDescription?.trim() || undefined}
                        dir={dir}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      {tCommon("fieldTags")}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {(tr?.tags ?? []).length > 0 ? (
                        tr!.tags!.map((tag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ══ DIALOGS ════════════════════════════════════════════════════════════ */}

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden sm:max-w-[700px]">
          <DialogHeader className="shrink-0 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <Pencil className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogEditTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("dialogEditDescription")}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-5 py-4 pr-1">
              {formError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {formError}
                </p>
              )}

              {/* Base fields */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("sectionBase")}
                </p>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {tCommon("fieldDate")}
                  </Label>
                  <NewsDateTimePicker
                    value={form.dateTime}
                    onChange={(next) =>
                      setForm((s) => ({ ...s, dateTime: next }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">
                      {tCommon("fieldIsActive")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {form.isActive
                        ? tCommon("statusActive")
                        : tCommon("statusInactive")}
                    </p>
                  </div>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) =>
                      setForm((s) => ({ ...s, isActive: v }))
                    }
                  />
                </div>
              </div>

              {/* Image upload */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tCommon("fieldImage")}
                </Label>
                <label
                  htmlFor="news-image-edit"
                  className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-background py-8 text-center transition-colors hover:border-border hover:bg-muted/30"
                >
                  <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted shadow-sm transition-colors group-hover:bg-background">
                    {imageFile ? (
                      <ImageIcon className="size-5 text-foreground" />
                    ) : (
                      <Upload className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  {imageFile ? (
                    <div>
                      <p className="text-sm font-medium">{imageFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(imageFile.size / 1024).toFixed(1)} KB ·{" "}
                        {tCommon("clickToReplace")}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">
                        {tCommon("clickToUpload")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("imageOptionalHint")}
                      </p>
                    </div>
                  )}
                  <Input
                    id="news-image-edit"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) =>
                      setImageFile(e.target.files?.[0] ?? null)
                    }
                  />
                </label>
              </div>

              {/* Translations */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {tCommon("translationsLabel")}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {tCommon("required")}
                  </Badge>
                </div>
                {(["en", "ar"] as const).map((loc) => {
                  const dir = loc === "ar" ? "rtl" : "ltr";
                  const v = form.translations[loc];
                  return (
                    <div
                      key={loc}
                      className="rounded-xl border border-border/60 bg-background p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">
                          {loc === "en" ? tCommon("langEn") : tCommon("langAr")}
                        </p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {loc}
                        </span>
                      </div>
                      <div className="grid gap-3">
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {tCommon("fieldTitle")}
                            <RequiredStar />
                          </Label>
                          <Input
                            dir={loc === "ar" ? "rtl" : "ltr"}
                            value={v.title}
                            className="h-9"
                            onChange={(e) =>
                              setForm((s) => ({
                                ...s,
                                translations: {
                                  ...s.translations,
                                  [loc]: { ...s.translations[loc], title: e.target.value },
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {tCommon("fieldSubtitle")}
                          </Label>
                          <Input
                            dir={loc === "ar" ? "rtl" : "ltr"}
                            value={v.subtitle}
                            className="h-9"
                            onChange={(e) =>
                              setForm((s) => ({
                                ...s,
                                translations: {
                                  ...s.translations,
                                  [loc]: { ...s.translations[loc], subtitle: e.target.value },
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {tCommon("fieldFullContent")}
                            <RequiredStar />
                          </Label>
                          <RichTextHtmlEditor
                            value={v.fullContent}
                            dir={loc === "ar" ? "rtl" : "ltr"}
                            onChange={(html) =>
                              setForm((s) => ({
                                ...s,
                                translations: {
                                  ...s.translations,
                                  [loc]: { ...s.translations[loc], fullContent: html },
                                },
                              }))
                            }
                          />
                        </div>
                        <div className="grid gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {tCommon("seoSection")}
                          </p>
                          <div className="grid gap-1.5">
                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              {tCommon("fieldMetaTitle")}
                            </Label>
                            <Input
                              dir={loc === "ar" ? "rtl" : "ltr"}
                              maxLength={META_TITLE_MAX_LENGTH}
                              value={v.metaTitle}
                              className="h-9"
                              onChange={(e) =>
                                setForm((s) => ({
                                  ...s,
                                  translations: {
                                    ...s.translations,
                                    [loc]: { ...s.translations[loc], metaTitle: e.target.value },
                                  },
                                }))
                              }
                            />
                            <p className="text-[10px] text-muted-foreground">{tCommon("fieldMetaTitleHint")}</p>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              {tCommon("fieldMetaDescription")}
                            </Label>
                            <Textarea
                              dir={loc === "ar" ? "rtl" : "ltr"}
                              maxLength={META_DESCRIPTION_MAX_LENGTH}
                              rows={2}
                              value={v.metaDescription}
                              className="resize-none text-sm"
                              onChange={(e) =>
                                setForm((s) => ({
                                  ...s,
                                  translations: {
                                    ...s.translations,
                                    [loc]: { ...s.translations[loc], metaDescription: e.target.value },
                                  },
                                }))
                              }
                            />
                            <p className="text-[10px] text-muted-foreground">{tCommon("fieldMetaDescriptionHint")}</p>
                          </div>
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {tCommon("fieldTags")}
                            <RequiredStar />
                          </Label>
                          <Input
                            dir={loc === "ar" ? "rtl" : "ltr"}
                            value={v.tags}
                            className="h-9"
                            onChange={(e) =>
                              setForm((s) => ({
                                ...s,
                                translations: {
                                  ...s.translations,
                                  [loc]: { ...s.translations[loc], tags: e.target.value },
                                },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <Separator className="shrink-0" />
          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setEditOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={saveDisabled}
              onClick={() => void onSave()}
              className="min-w-24 gap-1.5"
            >
              {submitting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Pencil className="size-3.5" />
              )}
              {t("update")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
                <Trash2 className="size-3.5 text-destructive" />
              </div>
              {t("deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("deleteConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-sm font-semibold">{bestTitle}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(news.date)}
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setDeleteOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void onDelete()}
              className="gap-1.5"
            >
              {submitting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              {t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove image */}
      <Dialog open={removeImageOpen} onOpenChange={setRemoveImageOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
                <X className="size-3.5 text-destructive" aria-hidden />
              </div>
              {t("removeImageTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("removeImageDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setRemoveImageOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void onRemoveImage()}
              className="gap-1.5"
            >
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              {t("confirmRemoveImage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
