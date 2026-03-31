"use client";

import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  Plus,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  Tag,
  FileText,
  Text,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "sonner";

import { toastApiError } from "@/lib/toast-api-error";
import {
  createHorse,
  fetchHorsesPage,
  normalizeHorseCoverImagePath,
  type HorseAdminListItem,
  type HorseCategory,
} from "@/lib/horses-api";

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

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const categories: readonly HorseCategory[] = ["stallion", "mare", "filly", "colt"];

function categoryLabel(t: (key: string) => string, c: HorseCategory): string {
  switch (c) {
    case "stallion":
      return t("category.stallion");
    case "mare":
      return t("category.mare");
    case "filly":
      return t("category.filly");
    case "colt":
      return t("category.colt");
  }
}

function parseCommaTags(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type HorseTranslationsForm = {
  en: {
    name: string;
    subtitle: string;
    shortBio: string;
    description: string;
    tags: string;
    metaTitle: string;
    metaDescription: string;
    sireName: string;
    damName: string;
    bloodline: string;
  };
  ar: {
    name: string;
    subtitle: string;
    shortBio: string;
    description: string;
    tags: string;
    metaTitle: string;
    metaDescription: string;
    sireName: string;
    damName: string;
    bloodline: string;
  };
};

function emptyTranslations(): HorseTranslationsForm {
  return {
    en: {
      name: "",
      subtitle: "",
      shortBio: "",
      description: "",
      tags: "",
      metaTitle: "",
      metaDescription: "",
      sireName: "",
      damName: "",
      bloodline: "",
    },
    ar: {
      name: "",
      subtitle: "",
      shortBio: "",
      description: "",
      tags: "",
      metaTitle: "",
      metaDescription: "",
      sireName: "",
      damName: "",
      bloodline: "",
    },
  };
}

const createHorseSchema = z.object({
  slug: z.string().trim().min(1, { message: "required" }),
  category: z.enum(categories),
  isActive: z.boolean().optional(),
  translations: z.any(), // validated separately (per-locale)
});

function hasBothLocalesRequired(tr: HorseTranslationsForm): boolean {
  return (["en", "ar"] as const).every((loc) => {
    const t = tr[loc];
    return (
      t.name.trim().length > 0 &&
      t.shortBio.trim().length > 0 &&
      t.description.trim().length > 0 &&
      parseCommaTags(t.tags).length > 0
    );
  });
}

function supportedLocales(row: HorseAdminListItem): Set<string> {
  return new Set((row.translations ?? []).map((t) => t.locale));
}

function pickName(row: HorseAdminListItem, locale: string): { name: string; subtitle: string } {
  const want = locale === "ar" ? "ar" : "en";
  const exact = row.translations?.find((t) => t.locale === want);
  const fallback = row.translations?.find((t) => t.locale === "en") ?? row.translations?.[0];
  const t = exact ?? fallback ?? null;
  return {
    name: t?.name?.trim() ? t.name : "—",
    subtitle: t?.subtitle ?? "",
  };
}

export function HorsesPanel() {
  const t = useTranslations("HorsesPage");
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<HorseAdminListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [form, setForm] = useState<{
    slug: string;
    category: HorseCategory;
    isActive: boolean;
    birthDate: string;
    color: string;
    heightCm: string;
    breeder: string;
    owner: string;
    notes: string;
    translations: HorseTranslationsForm;
  }>({
    slug: "",
    category: "stallion",
    isActive: true,
    birthDate: "",
    color: "",
    heightCm: "",
    breeder: "",
    owner: "",
    notes: "",
    translations: emptyTranslations(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchHorsesPage({ page, limit: PAGE_SIZE });
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
  }, [page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const createDisabled = useMemo(() => {
    const ok = createHorseSchema.safeParse({
      slug: form.slug,
      category: form.category,
      isActive: form.isActive,
      translations: form.translations,
    }).success;
    return submitting || !ok || !hasBothLocalesRequired(form.translations);
  }, [form, submitting]);

  async function onCreate() {
    setCreateError(null);
    const parsed = createHorseSchema.safeParse({
      slug: form.slug,
      category: form.category,
      isActive: form.isActive,
      translations: form.translations,
    });
    if (!parsed.success || !hasBothLocalesRequired(form.translations)) {
      setCreateError(t("createInvalid"));
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("slug", form.slug.trim());
      fd.append("category", form.category);
      fd.append("isActive", form.isActive ? "1" : "0");
      if (form.birthDate.trim()) fd.append("birthDate", form.birthDate.trim());
      if (form.color.trim()) fd.append("color", form.color.trim());
      if (form.heightCm.trim()) fd.append("heightCm", form.heightCm.trim());
      if (form.breeder.trim()) fd.append("breeder", form.breeder.trim());
      if (form.owner.trim()) fd.append("owner", form.owner.trim());
      if (form.notes.trim()) fd.append("notes", form.notes.trim());

      const translationsPayload = (["en", "ar"] as const).reduce(
        (acc, loc) => {
          const tt = form.translations[loc];
          acc[loc] = {
            name: tt.name.trim(),
            subtitle: tt.subtitle.trim(),
            description: tt.description.trim(),
            shortBio: tt.shortBio.trim(),
            tags: parseCommaTags(tt.tags),
            metaTitle: tt.metaTitle.trim(),
            metaDescription: tt.metaDescription.trim(),
            sireName: tt.sireName.trim(),
            damName: tt.damName.trim(),
            bloodline: tt.bloodline.trim(),
          };
          return acc;
        },
        {} as Record<string, unknown>
      );
      fd.append("translations", JSON.stringify(translationsPayload));

      if (coverFile) fd.append("coverImage", coverFile);

      await createHorse(fd);
      toast.success(t("createSuccess"));
      setCreateOpen(false);
      setCoverFile(null);
      setForm({
        slug: "",
        category: "stallion",
        isActive: true,
        birthDate: "",
        color: "",
        heightCm: "",
        breeder: "",
        owner: "",
        notes: "",
        translations: emptyTranslations(),
      });
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
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/50",
                  "text-muted-foreground"
                )}
              >
                <Trophy className="size-5" aria-hidden />
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
                {t("total")}: {loading ? "…" : total}
              </Badge>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {t("page")} {page} / {totalPages}
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

            <Button type="button" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" />
              {t("add")}
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
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-16 text-center">
              <Trophy className="size-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground">{t("empty")}</p>
              <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-6">{t("colHorse")}</TableHead>
                    <TableHead>{t("colCategory")}</TableHead>
                    <TableHead>{t("colStatus")}</TableHead>
                    <TableHead>{t("colLocales")}</TableHead>
                    <TableHead className="pe-6 text-right">{t("colAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const { name, subtitle } = pickName(row, locale);
                    const locales = supportedLocales(row);
                    const cover =
                      row.coverImage && row.coverImage.trim()
                        ? normalizeHorseCoverImagePath(row.coverImage)
                        : null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="ps-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                              {cover ? (
                                <img
                                  src={cover}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <ImageIcon className="size-4 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {name}
                              </p>
                              {subtitle ? (
                                <p className="truncate text-xs text-muted-foreground">
                                  {subtitle}
                                </p>
                              ) : (
                                <p className="truncate text-xs text-muted-foreground">
                                  {row.slug}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {categoryLabel(t, row.category)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.isActive === false ? (
                            <Badge variant="outline" className="font-normal text-muted-foreground">
                              {t("inactive")}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="font-normal">
                              {t("active")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {(["en", "ar"] as const).map((loc) => (
                              <Badge
                                key={loc}
                                variant={locales.has(loc) ? "secondary" : "outline"}
                                className={cn(
                                  "rounded-full px-2.5 py-0.5 text-xs font-normal",
                                  !locales.has(loc) && "text-muted-foreground"
                                )}
                              >
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
                            render={
                              <Link href={`/horses/${encodeURIComponent(row.id)}`}>
                                {t("view")}
                              </Link>
                            }
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Trophy className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {t("dialogCreateTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogCreateDescription")}</DialogDescription>
          </DialogHeader>

          <Separator />

          <div className="grid max-h-[62vh] gap-4 overflow-y-auto py-1 pr-1">
            {createError ? <p className="text-xs text-destructive">{createError}</p> : null}

            {/* Base fields */}
            <div className="grid gap-3 rounded-lg border bg-muted/10 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sectionBase")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldSlug")}</Label>
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                    placeholder={t("placeholderSlug")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldCategory")}</Label>
                  <select
                    className={cn(
                      "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    )}
                    value={form.category}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, category: e.target.value as HorseCategory }))
                    }
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(t, c)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldBirthDate")}</Label>
                  <Input
                    type="date"
                    value={form.birthDate}
                    onChange={(e) => setForm((s) => ({ ...s, birthDate: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldHeightCm")}</Label>
                  <Input
                    inputMode="numeric"
                    value={form.heightCm}
                    onChange={(e) => setForm((s) => ({ ...s, heightCm: e.target.value }))}
                    placeholder="160"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldColor")}</Label>
                  <Input
                    value={form.color}
                    onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))}
                    placeholder={t("placeholderColor")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldOwner")}</Label>
                  <Input
                    value={form.owner}
                    onChange={(e) => setForm((s) => ({ ...s, owner: e.target.value }))}
                    placeholder={t("placeholderOwner")}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldBreeder")}</Label>
                  <Input
                    value={form.breeder}
                    onChange={(e) => setForm((s) => ({ ...s, breeder: e.target.value }))}
                    placeholder={t("placeholderBreeder")}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldNotes")}</Label>
                  <Input
                    value={form.notes}
                    onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
                    placeholder={t("placeholderNotes")}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
                />
              </div>
            </div>

            {/* Cover image */}
            <div className="grid gap-1.5 rounded-lg border bg-muted/10 p-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <ImageIcon className="size-3 text-muted-foreground" aria-hidden />
                {t("fieldCoverImage")}
              </Label>
              <label
                htmlFor="horse-cover"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/10 py-8 text-center transition-colors hover:bg-muted/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm">
                  {coverFile ? (
                    <ImageIcon className="size-4 text-foreground" />
                  ) : (
                    <Upload className="size-4 text-muted-foreground" />
                  )}
                </div>
                {coverFile ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">{coverFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(coverFile.size / 1024).toFixed(1)} KB · {t("clickToReplace")}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground">{t("clickToUpload")}</p>
                    <p className="text-xs text-muted-foreground">{t("imageHint")}</p>
                  </div>
                )}
                <Input
                  id="horse-cover"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {/* Translations (required, stacked) */}
            <div className="grid gap-2 rounded-lg border bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("translationsLabel")}
                </p>
                <Badge variant="secondary" className="text-xs font-normal">
                  {t("required")}
                </Badge>
              </div>

              {(["en", "ar"] as const).map((loc) => {
                const dir = loc === "ar" ? "rtl" : "ltr";
                const langLabel = loc === "en" ? t("langEn") : t("langAr");
                const v = form.translations[loc];
                return (
                  <div key={loc} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">{langLabel}</p>
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                        {loc.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <Text className="size-3 text-muted-foreground" aria-hidden />
                          {t("fieldName")}
                        </Label>
                        <Input
                          dir={dir}
                          value={v.name}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              translations: {
                                ...s.translations,
                                [loc]: { ...s.translations[loc], name: e.target.value },
                              },
                            }))
                          }
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <FileText className="size-3 text-muted-foreground" aria-hidden />
                          {t("fieldSubtitle")}
                        </Label>
                        <Input
                          dir={dir}
                          value={v.subtitle}
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
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <FileText className="size-3 text-muted-foreground" aria-hidden />
                          {t("fieldShortBio")}
                        </Label>
                        <Textarea
                          dir={dir}
                          rows={2}
                          value={v.shortBio}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              translations: {
                                ...s.translations,
                                [loc]: { ...s.translations[loc], shortBio: e.target.value },
                              },
                            }))
                          }
                          className="resize-none text-sm"
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <FileText className="size-3 text-muted-foreground" aria-hidden />
                          {t("fieldDescription")}
                        </Label>
                        <Textarea
                          dir={dir}
                          rows={4}
                          value={v.description}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              translations: {
                                ...s.translations,
                                [loc]: { ...s.translations[loc], description: e.target.value },
                              },
                            }))
                          }
                          className="resize-none text-sm"
                        />
                      </div>

                      <div className="grid gap-1.5">
                        <Label className="flex items-center gap-1.5 text-sm font-medium">
                          <Tag className="size-3 text-muted-foreground" aria-hidden />
                          {t("fieldTags")}
                        </Label>
                        <Input
                          dir={dir}
                          value={v.tags}
                          onChange={(e) =>
                            setForm((s) => ({
                              ...s,
                              translations: {
                                ...s.translations,
                                [loc]: { ...s.translations[loc], tags: e.target.value },
                              },
                            }))
                          }
                          placeholder={t("placeholderTags")}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          <DialogFooter className="gap-2 pt-1 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void onCreate()}
              disabled={createDisabled}
              className="gap-1.5"
            >
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

