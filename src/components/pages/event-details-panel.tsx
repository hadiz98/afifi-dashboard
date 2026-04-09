"use client";

import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock,
  Globe,
  Image as ImageIcon,
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
import { z } from "zod";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { toastApiError } from "@/lib/toast-api-error";
import {
  anyEventFullContentOverLimit,
  buildEventTranslationsPayload,
  hasBothEventLocalesComplete,
  type EventLocaleFormRow,
} from "@/lib/events-form-helpers";
import {
  deleteEvent,
  deleteEventImage,
  fetchEventById,
  normalizeEventImagePath,
  updateEvent,
  type EventDetails,
  type EventLocale,
} from "@/lib/events-api";
import { META_DESCRIPTION_MAX_LENGTH, META_TITLE_MAX_LENGTH } from "@/lib/full-content-constants";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { NewsDateTimePicker } from "@/components/news-date-time-picker";
import { cn } from "@/lib/utils";

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
type TranslationsForm = Record<EventLocale, EventLocaleFormRow>;

function emptyTranslations(): TranslationsForm {
  const row: EventLocaleFormRow = {
    title: "",
    subtitle: "",
    fullContent: "",
    metaTitle: "",
    metaDescription: "",
  };
  return { en: { ...row }, ar: { ...row } };
}

function translationsFromItem(item: EventDetails): TranslationsForm {
  const base = emptyTranslations();
  for (const tr of item.translations ?? []) {
    if (tr.locale !== "en" && tr.locale !== "ar") continue;
    const fc =
      typeof tr.fullContent === "string"
        ? tr.fullContent
        : (tr as { description?: string | null }).description ?? "";
    base[tr.locale] = {
      title: tr.title ?? "",
      subtitle: tr.subtitle ?? "",
      fullContent: fc,
      metaTitle: tr.metaTitle ?? "",
      metaDescription: tr.metaDescription ?? "",
    };
  }
  return base;
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

const editSchema = z.object({
  slug: z.string().trim().min(1),
  startsAt: z.date(),
  endsAt: z.date().nullable(),
  isActive: z.boolean(),
});

// ─── Component ────────────────────────────────────────────────────────────────
export function EventDetailsPanel({ id }: { id: string }) {
  const t = useTranslations("EventDetailsPage");
  const tList = useTranslations("EventsPage");
  const locale = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<EventDetails | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeImageOpen, setRemoveImageOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editLocaleTab, setEditLocaleTab] = useState<EventLocale>(locale === "ar" ? "ar" : "en");

  const [form, setForm] = useState<{
    slug: string;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    translations: TranslationsForm;
  }>({
    slug: "", startsAt: null, endsAt: null, isActive: true,
    translations: emptyTranslations(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchEventById(id);
      setItem(next);
      setImageFile(null);
      setForm({
        slug: next.slug,
        startsAt: next.startsAt ? new Date(next.startsAt) : null,
        endsAt: next.endsAt ? new Date(next.endsAt) : null,
        isActive: next.isActive !== false,
        translations: translationsFromItem(next),
      });
    } catch (e) {
      toastApiError(e, t("loadError"));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { void load(); }, [load]);

  const saveDisabled = useMemo(() => {
    if (submitting) return true;
    const ok = editSchema.safeParse({
      slug: form.slug,
      startsAt: form.startsAt ?? undefined,
      endsAt: form.endsAt ?? null,
      isActive: form.isActive,
    }).success;
    if (!ok) return true;
    if (!hasBothEventLocalesComplete(form.translations)) return true;
    if (anyEventFullContentOverLimit(form.translations)) return true;
    if (form.endsAt && form.startsAt && form.endsAt < form.startsAt) return true;
    return false;
  }, [form, submitting]);

  async function onSave() {
    setFormError(null);
    const firstIncompleteLocale = (["en", "ar"] as const).find((loc) => {
      const tr = form.translations[loc];
      return !tr.title.trim() || !tr.subtitle.trim() || !tr.fullContent.trim();
    });
    const overLimitLocale = (["en", "ar"] as const).find(
      (loc) => form.translations[loc].fullContent.length > 50000
    );
    const ok = editSchema.safeParse({
      slug: form.slug,
      startsAt: form.startsAt ?? undefined,
      endsAt: form.endsAt ?? null,
      isActive: form.isActive,
    }).success;
    if (
      !ok ||
      !hasBothEventLocalesComplete(form.translations) ||
      anyEventFullContentOverLimit(form.translations)
    ) {
      if (overLimitLocale) setEditLocaleTab(overLimitLocale);
      else if (firstIncompleteLocale) setEditLocaleTab(firstIncompleteLocale);
      setFormError(t("invalid")); return;
    }
    if (form.endsAt && form.startsAt && form.endsAt < form.startsAt) {
      setFormError(t("endsBeforeStarts")); return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("slug", form.slug.trim());
      fd.append("startsAt", form.startsAt!.toISOString());
      if (form.endsAt) fd.append("endsAt", form.endsAt.toISOString());
      fd.append("isActive", form.isActive ? "1" : "0");
      fd.append("translations", JSON.stringify(buildEventTranslationsPayload(form.translations)));
      if (imageFile) fd.append("image", imageFile);
      const updated = await updateEvent(id, fd);
      toast.success(t("saveSuccess"));
      setEditOpen(false);
      setImageFile(null);
      setItem(updated);
      await load();
    } catch (e) {
      toastApiError(e, t("saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    setSubmitting(true);
    try {
      await deleteEvent(id);
      toast.success(t("deleteSuccess"));
      router.replace("/events");
    } catch (e) {
      toastApiError(e, t("deleteError"));
    } finally {
      setSubmitting(false);
      setDeleteOpen(false);
    }
  }

  async function onRemoveImage() {
    setSubmitting(true);
    try {
      await deleteEventImage(id);
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
    if (!item) return "—";
    const want = locale === "ar" ? "ar" : "en";
    const tr =
      item.translations?.find((x) => x.locale === want) ??
      item.translations?.[0];
    return tr?.title?.trim() ? tr.title : "—";
  })();

  const supported = new Set((item?.translations ?? []).map((x) => x.locale));
  const image = item?.image?.trim() ? normalizeEventImagePath(item.image) : null;

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-32" />
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
  if (!item) {
    return (
      <div className="mx-auto w-full max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-20 text-center">
          <CalendarClock className="mx-auto size-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium">{t("notFound")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("notFoundHint")}</p>
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
            <Link href="/events">
              <ArrowLeft className="size-4 rtl:rotate-180" />
              {t("back")}
            </Link>
          }
        />
        <div className="flex items-center gap-2">
          <Button
            type="button" variant="outline" size="sm" className="gap-1.5"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" />
            <span className="hidden sm:inline">{t("edit")}</span>
          </Button>
          <Button
            type="button" variant="destructive" size="sm" className="gap-1.5"
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
            {item.isActive !== false ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 className="size-3" />{tList("active")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <XCircle className="size-3" />{tList("inactive")}
              </span>
            )}
            {image && (
              <button
                type="button"
                onClick={() => setRemoveImageOpen(true)}
                disabled={submitting}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur transition-colors hover:border-destructive/50 hover:text-destructive"
              >
                <X className="size-3" />{t("removeImage")}
              </button>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="border-b border-border/60 px-4 py-4 sm:px-5">
          <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {bestTitle}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {item.slug}
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
              label: t("startsAtLabel"),
              value: formatWhen(item.startsAt, locale),
            },
            {
              icon: Clock,
              label: t("endsAtLabel"),
              value: item.endsAt ? formatWhen(item.endsAt, locale) : "—",
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
                  {value}
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
            const tr = item.translations.find((x) => x.locale === loc) ?? null;
            const dir = loc === "ar" ? "rtl" : "ltr";
            return (
              <div
                key={loc}
                className="rounded-xl border border-border/60 bg-background p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    {loc === "en" ? t("langEn") : t("langAr")}
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
                    label={t("fieldTitle")}
                    value={tr?.title?.trim() ? tr.title : undefined}
                    dir={dir}
                  />
                  <InfoField
                    label={t("fieldSubtitle")}
                    value={tr?.subtitle?.trim() ? tr.subtitle : undefined}
                    dir={dir}
                  />
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      {t("fieldFullContent")}
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
                        {t("seoSection")}
                      </p>
                      <InfoField label={t("fieldMetaTitle")} value={tr?.metaTitle?.trim() || undefined} dir={dir} />
                      <InfoField
                        label={t("fieldMetaDescription")}
                        value={tr?.metaDescription?.trim() || undefined}
                        dir={dir}
                      />
                    </div>
                  ) : null}
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("fieldSlug")}
                      <RequiredStar />
                    </Label>
                    <Input
                      value={form.slug}
                      className="h-9"
                      onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3">
                    <div>
                      <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {form.isActive ? tList("active") : tList("inactive")}
                      </p>
                    </div>
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("startsAtLabel")}
                      <RequiredStar />
                    </Label>
                    <NewsDateTimePicker
                      value={form.startsAt}
                      onChange={(next) => setForm((s) => ({ ...s, startsAt: next }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t("endsAtLabel")}
                    </Label>
                    <NewsDateTimePicker
                      value={form.endsAt}
                      onChange={(next) => setForm((s) => ({ ...s, endsAt: next }))}
                    />
                  </div>
                </div>
              </div>

              {/* Image upload */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("fieldImage")}
                </Label>
                <label
                  htmlFor="event-image-edit"
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
                        {(imageFile.size / 1024).toFixed(1)} KB · {t("clickToReplace")}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">{t("clickToUpload")}</p>
                      <p className="text-xs text-muted-foreground">{t("imageOptionalHint")}</p>
                    </div>
                  )}
                  <Input
                    id="event-image-edit"
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>

              {/* Translations */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("translationsLabel")}
                  </p>
                  <Badge variant="secondary" className="text-xs">{t("required")}</Badge>
                </div>
                <Tabs value={editLocaleTab} onValueChange={(v) => setEditLocaleTab(v === "ar" ? "ar" : "en")}>
                  <TabsList>
                    <TabsTrigger value="en">{t("langEn")}</TabsTrigger>
                    <TabsTrigger value="ar">{t("langAr")}</TabsTrigger>
                  </TabsList>
                {(["en", "ar"] as const).map((loc) => {
                  const dir = loc === "ar" ? "rtl" : "ltr";
                  const v = form.translations[loc];
                  return (
                    <TabsContent key={loc} value={loc} className="rounded-xl border border-border/60 bg-background p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold">
                          {loc === "en" ? t("langEn") : t("langAr")}
                        </p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {loc}
                        </span>
                      </div>
                      <div className="grid gap-3">
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t("fieldTitle")}
                            <RequiredStar />
                          </Label>
                          <Input
                            dir={dir}
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
                            {t("fieldSubtitle")}
                            <RequiredStar />
                          </Label>
                          <Input
                            dir={dir}
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
                            {t("fieldFullContent")}
                            <RequiredStar />
                          </Label>
                          <RichTextHtmlEditor
                            value={v.fullContent}
                            dir={dir}
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
                            {t("seoSection")}
                          </p>
                          <div className="grid gap-1.5">
                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              {t("fieldMetaTitle")}
                            </Label>
                            <Input
                              dir={dir}
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
                            <p className="text-[10px] text-muted-foreground">{t("fieldMetaTitleHint")}</p>
                          </div>
                          <div className="grid gap-1.5">
                            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                              {t("fieldMetaDescription")}
                            </Label>
                            <Textarea
                              dir={dir}
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
                            <p className="text-[10px] text-muted-foreground">{t("fieldMetaDescriptionHint")}</p>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  );
                })}
                </Tabs>
              </div>
            </div>
          </div>

          <Separator className="shrink-0" />
          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button
              type="button" variant="outline" disabled={submitting}
              onClick={() => setEditOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button" disabled={saveDisabled}
              onClick={() => void onSave()} className="min-w-24 gap-1.5"
            >
              {submitting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Pencil className="size-3.5" />
              )}
              {t("save")}
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
                <X className="size-3.5 text-destructive" />
              </div>
              {t("removeImageTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("removeImageDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button" variant="outline" disabled={submitting}
              onClick={() => setRemoveImageOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button" variant="destructive" disabled={submitting}
              onClick={() => void onRemoveImage()} className="gap-1.5"
            >
              {submitting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <X className="size-3.5" />
              )}
              {t("confirmRemoveImage")}
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
              {t("dialogDeleteTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("dialogDeleteDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-sm font-semibold">{bestTitle}</p>
            <p className="text-xs text-muted-foreground">{item.slug}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button" variant="outline" disabled={submitting}
              onClick={() => setDeleteOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button" variant="destructive" disabled={submitting}
              onClick={() => void onDelete()} className="gap-1.5"
            >
              {submitting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
