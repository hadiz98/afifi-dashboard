"use client";

import {
  ArrowLeft,
  CalendarClock,
  Image as ImageIcon,
  Pencil,
  RefreshCw,
  Trash2,
  X,
  FileText,
  Text,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { toastApiError } from "@/lib/toast-api-error";
import {
  deleteEvent,
  deleteEventImage,
  fetchEventById,
  normalizeEventImagePath,
  pickBestTranslation,
  updateEvent,
  type EventDetails,
  type EventLocale,
} from "@/lib/events-api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { NewsDateTimePicker } from "@/components/news-date-time-picker";
import { cn } from "@/lib/utils";

type TranslationsForm = Record<
  EventLocale,
  { title: string; subtitle: string; description: string }
>;

function emptyTranslations(): TranslationsForm {
  return {
    en: { title: "", subtitle: "", description: "" },
    ar: { title: "", subtitle: "", description: "" },
  };
}

function translationsFromItem(item: EventDetails): TranslationsForm {
  const base = emptyTranslations();
  for (const tr of item.translations ?? []) {
    if (tr.locale !== "en" && tr.locale !== "ar") continue;
    base[tr.locale] = {
      title: tr.title ?? "",
      subtitle: tr.subtitle ?? "",
      description: (tr.description ?? "") || "",
    };
  }
  return base;
}

function hasBothTranslationsRequired(tr: TranslationsForm): boolean {
  return (["en", "ar"] as const).every((loc) => {
    const t = tr[loc];
    return (
      t.title.trim().length > 0 &&
      t.subtitle.trim().length > 0 &&
      t.description.trim().length > 0
    );
  });
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
  slug: z.string().trim().min(1, { message: "required" }),
  startsAt: z.date(),
  endsAt: z.date().nullable(),
  isActive: z.boolean(),
});

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

  const [form, setForm] = useState<{
    slug: string;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    translations: TranslationsForm;
  }>({ slug: "", startsAt: null, endsAt: null, isActive: true, translations: emptyTranslations() });

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

  useEffect(() => {
    void load();
  }, [load]);

  const saveDisabled = useMemo(() => {
    if (submitting) return true;
    const parsed = editSchema.safeParse({
      slug: form.slug,
      startsAt: form.startsAt ?? undefined,
      endsAt: form.endsAt ?? null,
      isActive: form.isActive,
    });
    if (!parsed.success) return true;
    if (!hasBothTranslationsRequired(form.translations)) return true;
    if (form.endsAt && form.startsAt && form.endsAt.getTime() < form.startsAt.getTime()) return true;
    return false;
  }, [form, submitting]);

  async function onSave() {
    setFormError(null);
    const parsed = editSchema.safeParse({
      slug: form.slug,
      startsAt: form.startsAt ?? undefined,
      endsAt: form.endsAt ?? null,
      isActive: form.isActive,
    });
    if (!parsed.success || !hasBothTranslationsRequired(form.translations)) {
      setFormError(t("invalid"));
      return;
    }
    if (form.endsAt && form.startsAt && form.endsAt.getTime() < form.startsAt.getTime()) {
      setFormError(t("endsBeforeStarts"));
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("slug", form.slug.trim());
      fd.append("startsAt", form.startsAt!.toISOString());
      if (form.endsAt) fd.append("endsAt", form.endsAt.toISOString());
      fd.append("isActive", form.isActive ? "1" : "0");

      const translationsPayload = {
        en: {
          title: form.translations.en.title.trim(),
          subtitle: form.translations.en.subtitle.trim(),
          description: form.translations.en.description.trim(),
        },
        ar: {
          title: form.translations.ar.title.trim(),
          subtitle: form.translations.ar.subtitle.trim(),
          description: form.translations.ar.description.trim(),
        },
      };
      fd.append("translations", JSON.stringify(translationsPayload));

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

  const best = item ? pickBestTranslation(item, locale) : null;
  const title = best?.title?.trim() ? best.title : "—";
  const subtitle = best?.subtitle?.trim() ? best.subtitle : "";
  const image = item?.image?.trim() ? normalizeEventImagePath(item.image) : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8">
      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="border-b bg-card px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50", "text-muted-foreground")}>
                <CalendarClock className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="truncate text-xl font-semibold tracking-tight">
                  {loading ? t("loadingTitle") : title}
                </CardTitle>
                <CardDescription className="mt-1 max-w-xl truncate text-sm">
                  {loading ? t("loadingSubtitle") : subtitle || (item?.slug ?? "")}
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                nativeButton={false}
                render={
                  <Link href="/events">
                    <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
                    {t("back")}
                  </Link>
                }
              />
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={loading || !item} onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" aria-hidden />
                {t("edit")}
              </Button>
              <Button type="button" variant="destructive" size="sm" className="gap-1.5" disabled={loading || !item} onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-3.5" aria-hidden />
                {t("delete")}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-6">
          {loading ? (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !item ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-16 text-center">
              <CalendarClock className="size-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground">{t("notFound")}</p>
              <p className="text-xs text-muted-foreground">{t("notFoundHint")}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-lg border bg-muted/10 p-4 sm:grid-cols-[240px_1fr]">
                <div className="overflow-hidden rounded-lg border bg-muted">
                  {image ? (
                    <img
                      src={image}
                      alt={title}
                      className="h-48 w-full object-cover sm:h-full"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center sm:h-full">
                      <ImageIcon className="size-6 text-muted-foreground/40" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.isActive === false ? (
                      <Badge variant="outline" className="font-normal text-muted-foreground">{tList("inactive")}</Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">{tList("active")}</Badge>
                    )}
                    <Badge variant="outline" className="font-normal text-muted-foreground">{item.slug}</Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">{t("startsAtLabel")}</p>
                      <p className="text-sm font-medium">{formatWhen(item.startsAt, locale)}</p>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">{t("endsAtLabel")}</p>
                      <p className="text-sm font-medium">{item.endsAt ? formatWhen(item.endsAt, locale) : "—"}</p>
                    </div>
                  </div>

                  {image ? (
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRemoveImageOpen(true)} disabled={submitting}>
                      <X className="size-3.5" aria-hidden />
                      {t("removeImage")}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("translationsLabel")}</p>
                  <div className="flex gap-1.5">
                    {(["en", "ar"] as const).map((loc) => (
                      <Badge key={loc} variant={item.translations.some((x) => x.locale === loc) ? "secondary" : "outline"} className="rounded-full px-2.5 py-0.5 text-xs font-normal">
                        {loc.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>

                {(["en", "ar"] as const).map((loc) => {
                  const tr = item.translations.find((x) => x.locale === loc) ?? null;
                  const dir = loc === "ar" ? "rtl" : "ltr";
                  return (
                    <div key={loc} className="rounded-lg border bg-background p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">{loc === "en" ? t("langEn") : t("langAr")}</p>
                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">{loc.toUpperCase()}</Badge>
                      </div>

                      <div className="grid gap-2">
                        <div className="rounded-lg border bg-muted/10 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{t("fieldTitle")}</p>
                          <p className="text-sm font-medium" dir={dir}>{tr?.title?.trim() ? tr.title : "—"}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{t("fieldSubtitle")}</p>
                          <p className="text-sm" dir={dir}>{tr?.subtitle?.trim() ? tr.subtitle : "—"}</p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{t("fieldDescription")}</p>
                          <p className="text-sm whitespace-pre-wrap" dir={dir}>{tr?.description?.trim() ? tr.description : "—"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Pencil className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {t("dialogEditTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogEditDescription")}</DialogDescription>
          </DialogHeader>

          <Separator />

          <div className="grid max-h-[62vh] gap-4 overflow-y-auto py-1 pr-1">
            {formError ? <p className="text-xs text-destructive">{formError}</p> : null}

            <div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("sectionBase")}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldSlug")}</Label>
                  <Input value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} />
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                  <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NewsDateTimePicker value={form.startsAt} onChange={(next) => setForm((s) => ({ ...s, startsAt: next }))} required error={undefined} />
                <NewsDateTimePicker value={form.endsAt} onChange={(next) => setForm((s) => ({ ...s, endsAt: next }))} required={false} error={undefined} />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-sm">{t("fieldImage")}</Label>
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">{t("imageOptionalHint")}</p>
              </div>
            </div>

            <div className="grid gap-2 rounded-lg border bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("translationsLabel")}</p>
                <Badge variant="secondary" className="text-xs font-normal">{t("required")}</Badge>
              </div>

              {(["en", "ar"] as const).map((loc) => {
                const dir = loc === "ar" ? "rtl" : "ltr";
                const v = form.translations[loc];
                return (
                  <div key={loc} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">{loc === "en" ? t("langEn") : t("langAr")}</p>
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground">{loc.toUpperCase()}</Badge>
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <Text className="size-3 text-muted-foreground" aria-hidden />
                          {t("fieldTitle")}
                        </Label>
                        <Input dir={dir} value={v.title} onChange={(e) => setForm((s) => ({ ...s, translations: { ...s.translations, [loc]: { ...s.translations[loc], title: e.target.value } } }))} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <FileText className="size-3 text-muted-foreground" aria-hidden />
                          {t("fieldSubtitle")}
                        </Label>
                        <Input dir={dir} value={v.subtitle} onChange={(e) => setForm((s) => ({ ...s, translations: { ...s.translations, [loc]: { ...s.translations[loc], subtitle: e.target.value } } }))} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <FileText className="size-3 text-muted-foreground" aria-hidden />
                          {t("fieldDescription")}
                        </Label>
                        <Textarea dir={dir} rows={4} value={v.description} onChange={(e) => setForm((s) => ({ ...s, translations: { ...s.translations, [loc]: { ...s.translations[loc], description: e.target.value } } }))} className="resize-none text-sm" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <DialogFooter className="gap-2 pt-1 sm:gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={saveDisabled} onClick={() => void onSave()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeImageOpen} onOpenChange={setRemoveImageOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <X className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {t("removeImageTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("removeImageDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setRemoveImageOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={submitting} onClick={() => void onRemoveImage()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
              {t("confirmRemoveImage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {t("dialogDeleteTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogDeleteDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="rounded-lg border bg-muted/10 p-3 text-sm">
            <p className="font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{item?.slug ?? ""}</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setDeleteOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={submitting} onClick={() => void onDelete()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

