"use client";

import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "sonner";

import { toastApiError } from "@/lib/toast-api-error";
import {
  anyEventFullContentOverLimit,
  buildEventTranslationsPayload,
  hasBothEventLocalesComplete,
  type EventLocaleFormRow,
} from "@/lib/events-form-helpers";
import {
  createEvent,
  fetchEventsPage,
  normalizeEventImagePath,
  pickBestTranslation,
  type EventAdminListItem,
  type EventLocale,
} from "@/lib/events-api";
import { META_DESCRIPTION_MAX_LENGTH, META_TITLE_MAX_LENGTH } from "@/lib/full-content-constants";
import { RichTextHtmlEditor } from "@/components/rich-text/rich-text-html-editor";

import { Link } from "@/i18n/navigation";
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

import { NewsDateTimePicker } from "@/components/news-date-time-picker";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

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

const createSchema = z.object({
  slug: z.string().trim().min(1),
  startsAt: z.date(),
  endsAt: z.date().nullable(),
});

// ─── Stat badge ───────────────────────────────────────────────────────────────
function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function EventsPanel() {
  const t = useTranslations("EventsPage");
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EventAdminListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [form, setForm] = useState<{
    slug: string;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    translations: TranslationsForm;
  }>({
    slug: "",
    startsAt: new Date(),
    endsAt: null,
    isActive: true,
    translations: emptyTranslations(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchEventsPage({ page, limit: PAGE_SIZE });
      setRows(result.rows);
      setTotal(result.meta.total);
      setTotalPages(result.meta.pages);
    } catch (e) {
      toastApiError(e, t("loadError"));
      setRows([]); setTotal(0); setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => { void load(); }, [load]);

  const createDisabled = useMemo(() => {
    if (submitting) return true;
    const parsed = createSchema.safeParse({
      slug: form.slug,
      startsAt: form.startsAt ?? undefined,
      endsAt: form.endsAt ?? null,
    });
    if (!parsed.success) return true;
    if (!hasBothEventLocalesComplete(form.translations)) return true;
    if (anyEventFullContentOverLimit(form.translations)) return true;
    if (form.endsAt && form.startsAt && form.endsAt < form.startsAt) return true;
    return false;
  }, [form, submitting]);

  async function onCreate() {
    setCreateError(null);
    const parsed = createSchema.safeParse({
      slug: form.slug,
      startsAt: form.startsAt ?? undefined,
      endsAt: form.endsAt ?? null,
    });
    if (
      !parsed.success ||
      !hasBothEventLocalesComplete(form.translations) ||
      anyEventFullContentOverLimit(form.translations)
    ) {
      setCreateError(t("createInvalid"));
      return;
    }
    if (form.endsAt && form.startsAt && form.endsAt < form.startsAt) {
      setCreateError(t("endsBeforeStarts"));
      return;
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
      await createEvent(fd);
      toast.success(t("createSuccess"));
      setCreateOpen(false);
      setImageFile(null);
      setForm({ slug: "", startsAt: new Date(), endsAt: null, isActive: true, translations: emptyTranslations() });
      await load();
    } catch (e) {
      toastApiError(e, t("createError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <CalendarClock className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatBadge>{loading ? "…" : total} {t("total")}</StatBadge>
          <StatBadge>{t("page")} {page} / {totalPages || 1}</StatBadge>
          <Button
            type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
            disabled={loading} onClick={() => void load()}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            type="button" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-3.5" />{t("add")}
          </Button>
        </div>
      </div>

      {/* ── List card ───────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        {loading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-16 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex w-full flex-col items-center gap-2 py-20 text-center transition-colors hover:bg-muted/10"
          >
            <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
              <CalendarClock className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t("empty")}</p>
              <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
            </div>
          </button>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((row) => {
              const best = pickBestTranslation(row, locale);
              const img = row.image?.trim() ? normalizeEventImagePath(row.image) : null;
              const locales = new Set((row.translations ?? []).map((x) => x.locale));
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
                >
                  {/* Thumbnail */}
                  <div className="h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                    {img ? (
                      <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="size-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  {/* Name + when */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {best?.title?.trim() ? best.title : "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatWhen(row.startsAt, locale)}
                      {row.endsAt ? ` → ${formatWhen(row.endsAt, locale)}` : ""}
                    </p>
                  </div>

                  {/* Locale badges */}
                  <div className="hidden items-center gap-1 sm:flex">
                    {(["en", "ar"] as const).map((loc) => (
                      <span
                        key={loc}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          locales.has(loc)
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {loc}
                      </span>
                    ))}
                  </div>

                  {/* Status */}
                  {row.isActive !== false ? (
                    <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 sm:inline-flex">
                      <CheckCircle2 className="size-3" />{t("active")}
                    </span>
                  ) : (
                    <span className="hidden items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                      <XCircle className="size-3" />{t("inactive")}
                    </span>
                  )}

                  {/* View button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 gap-1 px-2.5 text-xs"
                    nativeButton={false}
                    render={<Link href={`/events/${encodeURIComponent(row.id)}`}>{t("view")}<ChevronRight className="size-3.5 rtl:rotate-180" /></Link>}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination footer */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {t("page")} {page} / {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button" variant="outline" size="sm"
                className="h-8 gap-1 px-2.5 text-xs"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="size-3.5 rtl:rotate-180" />
                {t("prev")}
              </Button>
              <Button
                type="button" variant="outline" size="sm"
                className="h-8 gap-1 px-2.5 text-xs"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                {t("next")}
                <ChevronRight className="size-3.5 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ══ Create dialog ════════════════════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden sm:max-w-[700px]">
          <DialogHeader className="shrink-0 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <CalendarClock className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogCreateTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("dialogCreateDescription")}
            </DialogDescription>
          </DialogHeader>
          <Separator />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-5 py-4 pr-1">
              {createError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {createError}
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
                      onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                      placeholder={t("placeholderSlug")}
                      className="h-9"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3">
                    <div>
                      <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {form.isActive ? t("active") : t("inactive")}
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
                  htmlFor="event-create-image"
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
                      <p className="text-xs text-muted-foreground">{t("imageHint")}</p>
                    </div>
                  )}
                  <Input
                    id="event-create-image"
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
                {(["en", "ar"] as const).map((loc) => {
                  const dir = loc === "ar" ? "rtl" : "ltr";
                  const v = form.translations[loc];
                  return (
                    <div key={loc} className="rounded-xl border border-border/60 bg-background p-4">
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
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <Separator className="shrink-0" />
          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button
              type="button" variant="outline" disabled={submitting}
              onClick={() => setCreateOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button" disabled={createDisabled}
              onClick={() => void onCreate()} className="min-w-24 gap-1.5"
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
    </div>
  );
}
