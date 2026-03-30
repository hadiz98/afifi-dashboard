"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/lib/toast-api-error";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Image as ImageIcon,
  Newspaper,
  Pencil,
  Save,
  Tag,
  Text,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { NewsDateTimePicker } from "@/components/news-date-time-picker";
import { deleteNews, fetchNewsById, pickBestTranslation, updateNews } from "@/lib/news-api";
import type { NewsItem } from "@/lib/news-api";
import { cn } from "@/lib/utils";

type EditFormState = {
  dateTime: Date | null;
  isActive: boolean;
  translations: {
    en: { title: string; subtitle: string; description: string; subDescription: string };
    ar: { title: string; subtitle: string; description: string; subDescription: string };
  };
  tagsByLocale: { en: string; ar: string };
};

function safeDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) return "";
  return tags.join(", ");
}

function safeString(v: string | null | undefined): string {
  return typeof v === "string" ? v : "";
}

function emptyTranslations() {
  return {
    en: { title: "", subtitle: "", description: "", subDescription: "" },
    ar: { title: "", subtitle: "", description: "", subDescription: "" },
  };
}

function parseCommaTags(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function hasAnyTranslation(tr: ReturnType<typeof emptyTranslations>): boolean {
  const values = [
    tr.en.title,
    tr.en.subtitle,
    tr.en.description,
    tr.en.subDescription,
    tr.ar.title,
    tr.ar.subtitle,
    tr.ar.description,
    tr.ar.subDescription,
  ];
  return values.some((v) => v.trim().length > 0);
}

function hasBothTranslationsRequired(
  tr: ReturnType<typeof emptyTranslations>,
  tagsByLocale: { en: string; ar: string }
): boolean {
  return (["en", "ar"] as const).every((loc) => {
    const t = tr[loc];
    const tags = parseCommaTags(tagsByLocale[loc]);
    return (
      t.title.trim().length > 0 &&
      t.description.trim().length > 0 &&
      tags.length > 0
    );
  });
}

export function NewsDetailsPanel({ id }: { id: string }) {
  const t = useTranslations("NewsDetailsPage");
  const tCommon = useTranslations("NewsPage");
  const locale = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState<EditFormState>({
    dateTime: null,
    isActive: true,
    translations: emptyTranslations(),
    tagsByLocale: { en: "", ar: "" },
  });
  const [updateError, setUpdateError] = useState<string | null>(null);

  function renderStatusBadge(isActive?: boolean) {
    if (isActive === false) {
      return (
        <Badge
          variant="outline"
          className="rounded-full border-muted-foreground/30 px-2.5 py-0.5 text-xs font-normal text-muted-foreground"
        >
          {tCommon("statusInactive")}
        </Badge>
      );
    }
    return (
      <Badge className="rounded-full border-emerald-600/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-normal text-emerald-700 dark:text-emerald-400">
        {tCommon("statusActive")}
      </Badge>
    );
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const item = await fetchNewsById(id);
      setNews(item);
      const enT = item.translations?.find((x) => x.locale === "en") ?? null;
      const arT = item.translations?.find((x) => x.locale === "ar") ?? null;
      setForm({
        dateTime: safeDate(item.date),
        isActive: item.isActive !== false,
        translations: {
          en: {
            title: safeString(enT?.title),
            subtitle: safeString(enT?.subtitle),
            description: safeString(enT?.description),
            subDescription: safeString(enT?.subDescription),
          },
          ar: {
            title: safeString(arT?.title),
            subtitle: safeString(arT?.subtitle),
            description: safeString(arT?.description),
            subDescription: safeString(arT?.subDescription),
          },
        },
        tagsByLocale: {
          en: parseTags(enT?.tags),
          ar: parseTags(arT?.tags),
        },
      });
    } catch (e) {
      toastApiError(e, t("loadError"));
      setError(t("loadError"));
      setNews(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [news?.id, news?.image]);

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

  async function onUpdate() {
    if (!news) return;
    const translationsOk = hasBothTranslationsRequired(
      form.translations,
      form.tagsByLocale
    );
    if (!translationsOk) {
      setUpdateError(tCommon("translationsBothRequired"));
      return;
    }

    setSubmitting(true);
    try {
      setUpdateError(null);
      const fd = new FormData();
      if (form.dateTime) fd.append("date", form.dateTime.toISOString());
      fd.append("isActive", form.isActive ? "true" : "false");
      if (imageFile) fd.append("image", imageFile);
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
    if (!news) return;
    setDeleting(true);
    try {
      await deleteNews(id);
      toast.success(t("deleteSuccess"));
      setDeleteOpen(false);
      router.push("/news");
    } catch (e) {
      toastApiError(e, t("deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <Card className="overflow-hidden border shadow-sm">
          <CardHeader className="pb-4">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="mt-1.5 h-4 w-72" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <Skeleton className="h-44 w-full rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[85%]" />
              <Skeleton className="h-4 w-[65%]" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!news || error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  const tr = pickBestTranslation(news, locale);
  const title = tr?.title ?? "—";
  const subtitle = tr?.subtitle ?? "";
  const description = tr?.description ?? "";
  const subDescription = tr?.subDescription ?? "";
  const tags = tr?.tags ?? [];
  const supported = new Set((news.translations ?? []).map((x) => x.locale));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-xs"
        nativeButton={false}
        render={
          <Link
            href="/news"
            className="flex items-center gap-1.5 rtl:flex-row-reverse"
          >
            <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
            {t("back")}
          </Link>
        }
      />
      <Card className="overflow-hidden border shadow-sm">
        
        {/* ── Header ─────────────────────────────────────────── */}
        <CardHeader className="border-b bg-card px-6 py-5">
          
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

            {/* Left: meta */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {renderStatusBadge(news.isActive)}
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="size-3" />
                  {formatDate(news.date)}
                </span>
              </div>
              <h1 className="mt-2 text-xl font-semibold leading-snug tracking-tight">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>

            {/* Right: actions */}
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-3.5" />
                {t("delete")}
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 px-3 text-xs"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" />
                {t("edit")}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {(["en", "ar"] as const).map((loc) => (
              <Badge
                key={loc}
                variant={supported.has(loc) ? "secondary" : "outline"}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-normal",
                  !supported.has(loc) && "text-muted-foreground"
                )}
              >
                {loc.toUpperCase()}
              </Badge>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          {news.image ? (
            <div className="flex justify-start">
              {!imageLoadFailed ? (
                <div className="relative w-full max-w-xl overflow-hidden rounded-lg border bg-muted">
                  <div className="relative aspect-video w-full">
                    <img
                      src={news.image}
                      alt={
                        title ? `${t("imageAlt")}: ${title}` : t("imageAlt")
                      }
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={() => setImageLoadFailed(true)}
                    />
                  </div>
                </div>
              ) : (
                <div
                  role="img"
                  aria-label={t("imageBroken")}
                  className="flex aspect-video w-full max-w-xl flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/40 px-6 text-center"
                >
                  <ImageIcon className="size-10 text-muted-foreground/50" aria-hidden />
                  <p className="text-sm text-muted-foreground">{t("imageBroken")}</p>
                </div>
              )}
            </div>
          ) : null}

          {/* Body text */}
          <div className="space-y-4">
            {(["en", "ar"] as const).map((loc) => {
              const tRow =
                news.translations?.find((x) => x.locale === loc) ?? null;
              if (!tRow) return null;
              return (
                <div key={loc} className="rounded-lg border bg-muted/10 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {loc.toUpperCase()}
                    </p>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {loc === "en" ? tCommon("langEn") : tCommon("langAr")}
                    </Badge>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold leading-snug",
                      loc === "ar" && "text-right"
                    )}
                    dir={loc === "ar" ? "rtl" : "ltr"}
                  >
                    {tRow.title}
                  </p>
                  {tRow.subtitle ? (
                    <p
                      className={cn(
                        "mt-1 text-sm text-muted-foreground",
                        loc === "ar" && "text-right"
                      )}
                      dir={loc === "ar" ? "rtl" : "ltr"}
                    >
                      {tRow.subtitle}
                    </p>
                  ) : null}

                  <div className="mt-3 space-y-2">
                    <p
                      className={cn(
                        "text-sm leading-relaxed whitespace-pre-wrap",
                        loc === "ar" && "text-right"
                      )}
                      dir={loc === "ar" ? "rtl" : "ltr"}
                    >
                      {tRow.description}
                    </p>
                    {tRow.subDescription ? (
                      <p
                        className={cn(
                          "text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap",
                          loc === "ar" && "text-right"
                        )}
                        dir={loc === "ar" ? "rtl" : "ltr"}
                      >
                        {tRow.subDescription}
                      </p>
                    ) : null}
                  </div>

                  {Array.isArray(tRow.tags) && tRow.tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tRow.tags.map((tag) => (
                        <Badge
                          key={`${loc}-${tag}`}
                          variant="secondary"
                          className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Tags are shown per translation above */}
        </CardContent>
      </Card>

      {/* ── Edit Dialog ────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Newspaper className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogEditTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("dialogEditDescription")}
            </DialogDescription>
          </DialogHeader>

          <Separator />

          <div className="grid max-h-[58vh] gap-3.5 overflow-y-auto py-1 pr-1">
            {updateError ? (
              <p className="text-xs text-destructive">{updateError}</p>
            ) : null}
            <div className="grid gap-2 rounded-lg border bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tCommon("translationsLabel")}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {tCommon("required")}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="grid gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{tCommon("langEn")}</p>
                  <Input
                    value={form.translations.en.title}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          en: { ...s.translations.en, title: e.target.value },
                        },
                      }));
                    }}
                    placeholder={`${tCommon("fieldTitle")} (${tCommon("langEn")})`}
                    className="h-8 text-sm"
                  />
                  <Input
                    value={form.translations.en.subtitle}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          en: { ...s.translations.en, subtitle: e.target.value },
                        },
                      }));
                    }}
                    placeholder={`${tCommon("fieldSubtitle")} (${tCommon("langEn")})`}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    rows={2}
                    value={form.translations.en.description}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          en: { ...s.translations.en, description: e.target.value },
                        },
                      }));
                    }}
                    placeholder={`${tCommon("fieldDescription")} (${tCommon("langEn")})`}
                    className="resize-none text-sm"
                  />
                  <Textarea
                    rows={2}
                    value={form.translations.en.subDescription}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          en: { ...s.translations.en, subDescription: e.target.value },
                        },
                      }));
                    }}
                    placeholder={`${tCommon("fieldSubDescription")} (${tCommon("langEn")})`}
                    className="resize-none text-sm"
                  />
                  <Input
                    value={form.tagsByLocale.en}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        tagsByLocale: { ...s.tagsByLocale, en: e.target.value },
                      }));
                    }}
                    placeholder={`${tCommon("fieldTags")} (${tCommon("langEn")})`}
                    className="h-8 text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{tCommon("langAr")}</p>
                  <Input
                    dir="rtl"
                    value={form.translations.ar.title}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          ar: { ...s.translations.ar, title: e.target.value },
                        },
                      }));
                    }}
                    placeholder={`${tCommon("fieldTitle")} (${tCommon("langAr")})`}
                    className="h-8 text-sm"
                  />
                  <Input
                    dir="rtl"
                    value={form.translations.ar.subtitle}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          ar: { ...s.translations.ar, subtitle: e.target.value },
                        },
                      }));
                    }}
                    placeholder={`${tCommon("fieldSubtitle")} (${tCommon("langAr")})`}
                    className="h-8 text-sm"
                  />
                  <Textarea
                    dir="rtl"
                    rows={2}
                    value={form.translations.ar.description}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          ar: { ...s.translations.ar, description: e.target.value },
                        },
                      }));
                    }}
                    placeholder={`${tCommon("fieldDescription")} (${tCommon("langAr")})`}
                    className="resize-none text-sm"
                  />
                  <Textarea
                    dir="rtl"
                    rows={2}
                    value={form.translations.ar.subDescription}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        translations: {
                          ...s.translations,
                          ar: { ...s.translations.ar, subDescription: e.target.value },
                        },
                      }));
                    }}
                    placeholder={`${tCommon("fieldSubDescription")} (${tCommon("langAr")})`}
                    className="resize-none text-sm"
                  />
                  <Input
                    dir="rtl"
                    value={form.tagsByLocale.ar}
                    onChange={(e) => {
                      setForm((s) => ({
                        ...s,
                        tagsByLocale: { ...s.tagsByLocale, ar: e.target.value },
                      }));
                    }}
                    placeholder={`${tCommon("fieldTags")} (${tCommon("langAr")})`}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            <NewsDateTimePicker
              value={form.dateTime}
              onChange={(next) => setForm((s) => ({ ...s, dateTime: next }))}
            />

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="news-edit-isActive"
                  className="cursor-pointer text-sm font-medium"
                >
                  {tCommon("fieldIsActive")}
                </Label>
                <Badge
                  variant={form.isActive ? "secondary" : "outline"}
                  className={cn(
                    "rounded-full px-2 py-0 text-xs font-normal",
                    form.isActive
                      ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-muted-foreground/20 text-muted-foreground"
                  )}
                >
                  {form.isActive ? tCommon("statusActive") : tCommon("statusInactive")}
                </Badge>
              </div>
              <Switch
                id="news-edit-isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
              />
            </div>

            {/* Image upload */}
            <FieldGroup
              id="news-edit-image"
              icon={<ImageIcon className="size-3" />}
              label={tCommon("fieldImage")}
              hint={t("imageOptionalHint")}
            >
              <Input
                id="news-edit-image"
                type="file"
                accept="image/*"
                className="h-8 cursor-pointer text-xs"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
            </FieldGroup>
          </div>

          <Separator />

          <DialogFooter className="gap-2 pt-1 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditOpen(false)}
              disabled={submitting}
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <X className="size-3.5" />
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void onUpdate()}
              disabled={
                submitting ||
                !hasBothTranslationsRequired(form.translations, form.tagsByLocale)
              }
              className="h-8 gap-1.5 px-3 text-xs"
            >
              <Save className="size-3.5" />
              {t("update")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10">
                <Trash2 className="size-3.5 text-destructive" aria-hidden />
              </div>
              {t("deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("deleteConfirmDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs"
              onClick={() => void onDelete()}
              disabled={deleting}
            >
              <Trash2 className="size-3.5" />
              {deleting ? t("deleting") : t("deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Small helper: labeled field group ──────────────────── */
function FieldGroup({
  id,
  icon,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label
        htmlFor={id}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
      >
        {icon}
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}