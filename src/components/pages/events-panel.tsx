"use client";

import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Text,
  FileText,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "sonner";

import { toastApiError } from "@/lib/toast-api-error";
import {
  createEvent,
  fetchEventsPage,
  normalizeEventImagePath,
  pickBestTranslation,
  type EventAdminListItem,
  type EventLocale,
} from "@/lib/events-api";

import { Link } from "@/i18n/navigation";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { NewsDateTimePicker } from "@/components/news-date-time-picker";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

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

const createSchema = z.object({
  slug: z.string().trim().min(1, { message: "required" }),
  startsAt: z.date(),
  endsAt: z.date().nullable(),
});

export function EventsPanel() {
  const t = useTranslations("EventsPage");
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<{ rows: EventAdminListItem[]; total: number; pages: number }>({
    rows: [],
    total: 0,
    pages: 1,
  });

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
    startsAt: null,
    endsAt: null,
    isActive: true,
    translations: emptyTranslations(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchEventsPage({ page, limit: PAGE_SIZE });
      setBundle({ rows: result.rows, total: result.meta.total, pages: result.meta.pages });
    } catch (e) {
      toastApiError(e, t("loadError"));
      setBundle({ rows: [], total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDisabled = useMemo(() => {
    if (submitting) return true;
    const parsed = createSchema.safeParse({
      slug: form.slug,
      startsAt: form.startsAt ?? undefined,
      endsAt: form.endsAt ?? null,
    });
    if (!parsed.success) return true;
    if (!hasBothTranslationsRequired(form.translations)) return true;
    if (form.endsAt && form.startsAt && form.endsAt.getTime() < form.startsAt.getTime()) return true;
    return false;
  }, [form, submitting]);

  async function onCreate() {
    setCreateError(null);
    const parsed = createSchema.safeParse({
      slug: form.slug,
      startsAt: form.startsAt ?? undefined,
      endsAt: form.endsAt ?? null,
    });
    if (!parsed.success || !hasBothTranslationsRequired(form.translations)) {
      setCreateError(t("createInvalid"));
      return;
    }
    if (form.endsAt && form.startsAt && form.endsAt.getTime() < form.startsAt.getTime()) {
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

      await createEvent(fd);
      toast.success(t("createSuccess"));
      setCreateOpen(false);
      setImageFile(null);
      setForm({ slug: "", startsAt: null, endsAt: null, isActive: true, translations: emptyTranslations() });
      await load();
    } catch (e) {
      toastApiError(e, t("createError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <Card className="overflow-hidden border shadow-sm">
        <CardHeader className="border-b bg-card px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50", "text-muted-foreground")}>
                <CalendarClock className="size-5" aria-hidden />
              </div>
              <div>
                <CardTitle className="text-xl font-semibold tracking-tight">{t("title")}</CardTitle>
                <CardDescription className="mt-1 max-w-xl text-sm">{t("description")}</CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="font-normal">
                {t("total")}: {loading ? "…" : bundle.total}
              </Badge>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {t("page")} {page} / {bundle.pages || 1}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={loading} onClick={() => void load()}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
              {t("refresh")}
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              {t("add")}
            </Button>
            <div className="ms-auto flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))} className="gap-1">
                <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
                {t("prev")}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={page >= bundle.pages || loading} onClick={() => setPage((p) => Math.min(Math.max(1, bundle.pages), p + 1))} className="gap-1">
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
              <CalendarClock className="size-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground">{t("empty")}</p>
              <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-6">{t("colEvent")}</TableHead>
                    <TableHead>{t("colWhen")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead>{t("colLocales")}</TableHead>
                    <TableHead className="pe-6 text-right">{t("colAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.rows.map((row) => {
                    const best = pickBestTranslation(row, locale);
                    const img = row.image?.trim() ? normalizeEventImagePath(row.image) : null;
                    const locales = new Set((row.translations ?? []).map((x) => x.locale));
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="ps-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                              {img ? (
                                <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <ImageIcon className="size-4 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{best?.title?.trim() ? best.title : "—"}</p>
                              <p className="truncate text-xs text-muted-foreground">{best?.subtitle?.trim() ? best.subtitle : row.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="grid gap-0.5">
                            <span>{t("startsAtLabel")}: {formatWhen(row.startsAt, locale)}</span>
                            <span>{t("endsAtLabel")}: {row.endsAt ? formatWhen(row.endsAt, locale) : "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {row.isActive === false ? (
                            <Badge variant="outline" className="font-normal text-muted-foreground">{t("inactive")}</Badge>
                          ) : (
                            <Badge variant="secondary" className="font-normal">{t("active")}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {(["en", "ar"] as const).map((loc) => (
                              <Badge key={loc} variant={locales.has(loc) ? "secondary" : "outline"} className={cn("rounded-full px-2.5 py-0.5 text-xs font-normal", !locales.has(loc) && "text-muted-foreground")}>
                                {loc.toUpperCase()}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="pe-6 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            nativeButton={false}
                            render={<Link href={`/events/${encodeURIComponent(row.id)}`}>{t("view")}</Link>}
                          />
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {t("dialogCreateTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogCreateDescription")}</DialogDescription>
          </DialogHeader>

          <Separator />

          <div className="grid max-h-[62vh] gap-4 overflow-y-auto py-1 pr-1">
            {createError ? <p className="text-xs text-destructive">{createError}</p> : null}

            <div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("sectionBase")}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldSlug")}</Label>
                  <Input value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} placeholder={t("placeholderSlug")} />
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                  <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NewsDateTimePicker
                  value={form.startsAt}
                  onChange={(next) => setForm((s) => ({ ...s, startsAt: next }))}
                  required
                  error={null}
                  className="sm:col-span-1"
                />
                <NewsDateTimePicker
                  value={form.endsAt}
                  onChange={(next) => setForm((s) => ({ ...s, endsAt: next }))}
                  required={false}
                  error={null}
                  className="sm:col-span-1"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-sm">{t("fieldImage")}</Label>
                <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">{t("imageHint")}</p>
              </div>
            </div>

            <div className="grid gap-2 rounded-lg border bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("translationsLabel")}</p>
                <Badge variant="secondary" className="text-xs font-normal">{t("required")}</Badge>
              </div>

              {(["en", "ar"] as const).map((loc) => {
                const dir = loc === "ar" ? "rtl" : "ltr";
                const langLabel = loc === "en" ? t("langEn") : t("langAr");
                const v = form.translations[loc];
                return (
                  <div key={loc} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">{langLabel}</p>
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
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setCreateOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={createDisabled} onClick={() => void onCreate()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

