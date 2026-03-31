"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChessKnight,
  Plus,
  RefreshCw,
  Upload,
  Image as ImageIcon,
  Tag,
  FileText,
  Text,
  CheckCircle2,
  XCircle,
  Calendar,
  Ruler,
  Palette,
  User,
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

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const categories: readonly HorseCategory[] = ["stallion", "mare", "filly", "colt"];

function categoryLabel(t: (key: string) => string, c: HorseCategory): string {
  switch (c) {
    case "stallion": return t("category.stallion");
    case "mare": return t("category.mare");
    case "filly": return t("category.filly");
    case "colt": return t("category.colt");
  }
}

function parseCommaTags(input: string): string[] {
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

type HorseTranslationsForm = {
  en: { name: string; subtitle: string; shortBio: string; description: string; tags: string; metaTitle: string; metaDescription: string; sireName: string; damName: string; bloodline: string };
  ar: { name: string; subtitle: string; shortBio: string; description: string; tags: string; metaTitle: string; metaDescription: string; sireName: string; damName: string; bloodline: string };
};

function emptyTranslations(): HorseTranslationsForm {
  const empty = { name: "", subtitle: "", shortBio: "", description: "", tags: "", metaTitle: "", metaDescription: "", sireName: "", damName: "", bloodline: "" };
  return { en: { ...empty }, ar: { ...empty } };
}

const createHorseSchema = z.object({
  slug: z.string().trim().min(1),
  category: z.enum(categories),
  isActive: z.boolean().optional(),
  translations: z.any(),
});

function hasBothLocalesRequired(tr: HorseTranslationsForm): boolean {
  return (["en", "ar"] as const).every((loc) => {
    const t = tr[loc];
    return t.name.trim().length > 0 && t.shortBio.trim().length > 0 &&
      t.description.trim().length > 0 && parseCommaTags(t.tags).length > 0;
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
  return { name: t?.name?.trim() ? t.name : "—", subtitle: t?.subtitle ?? "" };
}

// ─── Small stat badge ──────────────────────────────────────────────────────────
function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
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
    slug: string; category: HorseCategory; isActive: boolean;
    birthDate: string; color: string; heightCm: string;
    breeder: string; owner: string; notes: string;
    translations: HorseTranslationsForm;
  }>({
    slug: "", category: "stallion", isActive: true, birthDate: "",
    color: "", heightCm: "", breeder: "", owner: "", notes: "",
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
      setRows([]); setTotal(0); setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, t]);

  useEffect(() => { void load(); }, [load]);

  const createDisabled = useMemo(() => {
    const ok = createHorseSchema.safeParse({ slug: form.slug, category: form.category, isActive: form.isActive, translations: form.translations }).success;
    return submitting || !ok || !hasBothLocalesRequired(form.translations);
  }, [form, submitting]);

  async function onCreate() {
    setCreateError(null);
    const parsed = createHorseSchema.safeParse({ slug: form.slug, category: form.category, isActive: form.isActive, translations: form.translations });
    if (!parsed.success || !hasBothLocalesRequired(form.translations)) { setCreateError(t("createInvalid")); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("slug", form.slug.trim()); fd.append("category", form.category);
      fd.append("isActive", form.isActive ? "1" : "0");
      if (form.birthDate.trim()) fd.append("birthDate", form.birthDate.trim());
      if (form.color.trim()) fd.append("color", form.color.trim());
      if (form.heightCm.trim()) fd.append("heightCm", form.heightCm.trim());
      if (form.breeder.trim()) fd.append("breeder", form.breeder.trim());
      if (form.owner.trim()) fd.append("owner", form.owner.trim());
      if (form.notes.trim()) fd.append("notes", form.notes.trim());
      const translationsPayload = (["en", "ar"] as const).reduce((acc, loc) => {
        const tt = form.translations[loc];
        acc[loc] = {
          name: tt.name.trim(), subtitle: tt.subtitle.trim(), description: tt.description.trim(),
          shortBio: tt.shortBio.trim(), tags: parseCommaTags(tt.tags), metaTitle: tt.metaTitle.trim(),
          metaDescription: tt.metaDescription.trim(), sireName: tt.sireName.trim(),
          damName: tt.damName.trim(), bloodline: tt.bloodline.trim(),
        };
        return acc;
      }, {} as Record<string, unknown>);
      fd.append("translations", JSON.stringify(translationsPayload));
      if (coverFile) fd.append("coverImage", coverFile);
      await createHorse(fd);
      toast.success(t("createSuccess"));
      setCreateOpen(false); setCoverFile(null);
      setForm({ slug: "", category: "stallion", isActive: true, birthDate: "", color: "", heightCm: "", breeder: "", owner: "", notes: "", translations: emptyTranslations() });
      await load();
    } catch (e) { toastApiError(e, t("createError")); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">

      {/* ── Page header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <ChessKnight className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatBadge>{loading ? "…" : total} {t("total")}</StatBadge>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
            disabled={loading} onClick={() => void load()}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          <Button type="button" size="sm" className="h-8 gap-1.5 text-xs"
            onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />{t("add")}
          </Button>
        </div>
      </div>

      {/* ── List card ─────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">

        {loading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-16 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-7 w-14 rounded-lg" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <button type="button" onClick={() => setCreateOpen(true)}
            className="flex w-full flex-col items-center gap-3 py-20 text-center transition-colors hover:bg-muted/20">
            <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted shadow-sm">
              <ChessKnight className="size-5 text-muted-foreground/50" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{t("empty")}</p>
              <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm">
              <Plus className="size-3" />{t("add")}
            </span>
          </button>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-border/60 sm:hidden">
              {rows.map((row) => {
                const { name, subtitle } = pickName(row, locale);
                const locales = supportedLocales(row);
                const cover = row.coverImage?.trim() ? normalizeHorseCoverImagePath(row.coverImage) : null;
                return (
                  <Link key={row.id} href={`/horses/${encodeURIComponent(row.id)}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 active:bg-muted/50">
                    {/* Thumbnail */}
                    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                      {cover ? (
                        <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="size-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                      <p className="truncate text-xs text-muted-foreground">{subtitle || row.slug}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {categoryLabel(t, row.category)}
                        </span>
                        {row.isActive !== false ? (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-2.5" />{t("active")}
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                            <XCircle className="size-2.5" />{t("inactive")}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Locale pills */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {(["en", "ar"] as const).map((loc) => (
                        <span key={loc} className={cn(
                          "rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                          locales.has(loc) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/50"
                        )}>{loc}</span>
                      ))}
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground/40 shrink-0 rtl:rotate-180" />
                  </Link>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colHorse")}</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colCategory")}</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colStatus")}</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colLocales")}</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("colAction")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {rows.map((row) => {
                    const { name, subtitle } = pickName(row, locale);
                    const locales = supportedLocales(row);
                    const cover = row.coverImage?.trim() ? normalizeHorseCoverImagePath(row.coverImage) : null;
                    return (
                      <tr key={row.id} className="group transition-colors hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                              {cover ? (
                                <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <ImageIcon className="size-3.5 text-muted-foreground/30" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{name}</p>
                              <p className="truncate text-xs text-muted-foreground">{subtitle || row.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            {categoryLabel(t, row.category)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {row.isActive !== false ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                              <CheckCircle2 className="size-3" />{t("active")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                              <XCircle className="size-3" />{t("inactive")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {(["en", "ar"] as const).map((loc) => (
                              <span key={loc} className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                locales.has(loc) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/50"
                              )}>{loc}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="outline" size="sm"
                            className="h-7 gap-1.5 px-3 text-xs"
                            nativeButton={false}
                            render={
                              <Link href={`/horses/${encodeURIComponent(row.id)}`}>
                                {t("view")}
                                <ChevronRight className="size-3.5 rtl:rotate-180" />
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

        {/* ── Pagination footer ─────────────────────────────────────────────── */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              {t("page")} <span className="font-medium text-foreground">{page}</span> / <span className="font-medium text-foreground">{totalPages}</span>
            </p>
            <div className="flex items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="size-3.5 rtl:rotate-180" />
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 w-7 p-0"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRight className="size-3.5 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ══ Create dialog ══════════════════════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92dvh] overflow-hidden flex flex-col sm:max-w-[680px]">
          <DialogHeader className="shrink-0 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <ChessKnight className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogCreateTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogCreateDescription")}</DialogDescription>
          </DialogHeader>

          <Separator className="shrink-0" />

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-5 py-4 pr-1">
              {createError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{createError}</p>
              )}

              {/* Base fields */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("sectionBase")}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldSlug")}</Label>
                    <Input value={form.slug} className="h-9" placeholder={t("placeholderSlug")}
                      onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldCategory")}</Label>
                    <select
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.category}
                      onChange={(e) => setForm((s) => ({ ...s, category: e.target.value as HorseCategory }))}>
                      {categories.map((c) => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldBirthDate")}</Label>
                    <Input type="date" value={form.birthDate} className="h-9"
                      onChange={(e) => setForm((s) => ({ ...s, birthDate: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldHeightCm")}</Label>
                    <Input inputMode="numeric" value={form.heightCm} placeholder="160" className="h-9"
                      onChange={(e) => setForm((s) => ({ ...s, heightCm: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldColor")}</Label>
                    <Input value={form.color} className="h-9" placeholder={t("placeholderColor")}
                      onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldOwner")}</Label>
                    <Input value={form.owner} className="h-9" placeholder={t("placeholderOwner")}
                      onChange={(e) => setForm((s) => ({ ...s, owner: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldBreeder")}</Label>
                    <Input value={form.breeder} className="h-9" placeholder={t("placeholderBreeder")}
                      onChange={(e) => setForm((s) => ({ ...s, breeder: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldNotes")}</Label>
                    <Input value={form.notes} className="h-9" placeholder={t("placeholderNotes")}
                      onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                    <p className="text-xs text-muted-foreground">{form.isActive ? t("active") : t("inactive")}</p>
                  </div>
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
                </div>
              </div>

              {/* Cover image */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("fieldCoverImage")}</Label>
                <label htmlFor="horse-cover"
                  className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-background py-8 text-center transition-colors hover:border-border hover:bg-muted/30">
                  <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted shadow-sm transition-colors group-hover:bg-background">
                    {coverFile ? <ImageIcon className="size-5 text-foreground" /> : <Upload className="size-5 text-muted-foreground" />}
                  </div>
                  {coverFile ? (
                    <div>
                      <p className="text-sm font-medium">{coverFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(coverFile.size / 1024).toFixed(1)} KB · {t("clickToReplace")}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">{t("clickToUpload")}</p>
                      <p className="text-xs text-muted-foreground">{t("imageHint")}</p>
                    </div>
                  )}
                  <Input id="horse-cover" type="file" accept="image/*" className="sr-only"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>

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
                          { key: "name" as const, label: t("fieldName"), type: "input" },
                          { key: "subtitle" as const, label: t("fieldSubtitle"), type: "input" },
                          { key: "shortBio" as const, label: t("fieldShortBio"), type: "textarea", rows: 2 },
                          { key: "description" as const, label: t("fieldDescription"), type: "textarea", rows: 4 },
                          { key: "tags" as const, label: t("fieldTags"), type: "input", placeholder: t("placeholderTags") },
                        ].map(({ key, label, type, rows, placeholder }) => (
                          <div key={key} className="grid gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</Label>
                            {type === "textarea" ? (
                              <Textarea dir={dir} rows={rows} value={v[key]} className="resize-none text-sm"
                                onChange={(e) => setForm((s) => ({ ...s, translations: { ...s.translations, [loc]: { ...s.translations[loc], [key]: e.target.value } } }))} />
                            ) : (
                              <Input dir={dir} value={v[key]} className="h-9" placeholder={placeholder}
                                onChange={(e) => setForm((s) => ({ ...s, translations: { ...s.translations, [loc]: { ...s.translations[loc], [key]: e.target.value } } }))} />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <Separator className="shrink-0" />

          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setCreateOpen(false)}>{t("cancel")}</Button>
            <Button type="button" disabled={createDisabled} onClick={() => void onCreate()} className="gap-1.5 min-w-24">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}