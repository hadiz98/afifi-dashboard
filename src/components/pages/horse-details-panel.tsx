"use client";

import {
  ArrowLeft,
  ChessKnight,
  Pencil,
  Trash2,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Images,
  Plus,
  PencilLine,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Upload,
  Award,
  FileText,
  Tag,
  Text,
  Globe,
  Calendar,
  Ruler,
  Palette,
  User,
  Building2,
  StickyNote,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Eye,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { toastApiError } from "@/lib/toast-api-error";
import {
  deleteHorse,
  fetchHorseById,
  fetchHorseMedia,
  addHorseMedia,
  replaceHorseMediaFile,
  updateHorseMediaMeta,
  deleteHorseMedia,
  reorderHorseMedia,
  fetchHorseAwards,
  createHorseAward,
  updateHorseAward,
  deleteHorseAward,
  normalizeHorseCoverImagePath,
  updateHorse,
  type HorseCategory,
  type HorseDetails,
  type HorseLocale,
  type HorseMedia,
  type HorseAward,
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
import { Textarea } from "@/components/ui/textarea";

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

type TranslationsForm = Record<
  HorseLocale,
  {
    name: string; subtitle: string; shortBio: string; description: string;
    tags: string; metaTitle: string; metaDescription: string;
    sireName: string; damName: string; bloodline: string;
  }
>;

function emptyTranslations(): TranslationsForm {
  const empty = { name: "", subtitle: "", shortBio: "", description: "", tags: "", metaTitle: "", metaDescription: "", sireName: "", damName: "", bloodline: "" };
  return { en: { ...empty }, ar: { ...empty } };
}

function translationsFromItem(item: HorseDetails): TranslationsForm {
  const base = emptyTranslations();
  for (const tr of item.translations ?? []) {
    if (tr.locale !== "en" && tr.locale !== "ar") continue;
    base[tr.locale] = {
      name: tr.name ?? "", subtitle: tr.subtitle ?? "",
      shortBio: tr.shortBio ?? "", description: (tr.description ?? "") || "",
      tags: (tr.tags ?? []).join(", "), metaTitle: (tr.metaTitle ?? "") || "",
      metaDescription: (tr.metaDescription ?? "") || "",
      sireName: (tr.sireName ?? "") || "", damName: (tr.damName ?? "") || "",
      bloodline: (tr.bloodline ?? "") || "",
    };
  }
  return base;
}

function hasBothLocalesRequired(tr: TranslationsForm): boolean {
  return (["en", "ar"] as const).every((loc) => {
    const t = tr[loc];
    return t.name.trim().length > 0 && t.shortBio.trim().length > 0 &&
      t.description.trim().length > 0 && parseCommaTags(t.tags).length > 0;
  });
}

const updateSchema = z.object({
  slug: z.string().trim().min(1),
  category: z.enum(categories),
  isActive: z.boolean(),
});

const awardSchema = z.object({
  year: z.string().trim().min(4).refine((v) => Number.isFinite(Number(v))),
  eventName: z.string().trim().min(1),
  title: z.string().trim().min(1),
  placing: z.string().trim().optional(),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function pickBestName(item: HorseDetails, locale: string): { name: string; subtitle: string } {
  const want = locale === "ar" ? "ar" : "en";
  const exact = item.translations?.find((t) => t.locale === want);
  const fallback = item.translations?.find((t) => t.locale === "en") ?? item.translations?.[0];
  const t = exact ?? fallback ?? null;
  return { name: t?.name?.trim() ? t.name : "—", subtitle: t?.subtitle ?? "" };
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, description, badge, actions, children }: {
  icon: React.ElementType; title: string; description?: string;
  badge?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background shadow-sm">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              {badge}
            </div>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Info field ───────────────────────────────────────────────────────────────
function InfoField({ label, value, dir }: { label: string; value?: string | number | null; dir?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="text-sm font-medium text-foreground" dir={dir}>{value ?? "—"}</p>
    </div>
  );
}

// ─── Stat pill ────────────────────────────────────────────────────────────────
function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function HorseDetailsPanel({ id }: { id: string }) {
  const t = useTranslations("HorseDetailsPage");
  const tList = useTranslations("HorsesPage");
  const tMedia = useTranslations("HorsesMedia");
  const tAwards = useTranslations("HorsesAwards");
  const locale = useLocale();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<HorseDetails | null>(null);

  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaRows, setMediaRows] = useState<HorseMedia[]>([]);
  const [mediaReorderMode, setMediaReorderMode] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [mediaUploadOpen, setMediaUploadOpen] = useState(false);
  const [mediaUploadFile, setMediaUploadFile] = useState<File | null>(null);
  const [mediaUploadCaption, setMediaUploadCaption] = useState("");
  const [mediaUploadSortOrder, setMediaUploadSortOrder] = useState("");

  const [mediaEditOpen, setMediaEditOpen] = useState(false);
  const [mediaEditId, setMediaEditId] = useState<string | null>(null);
  const [mediaEditCaption, setMediaEditCaption] = useState("");
  const [mediaEditSortOrder, setMediaEditSortOrder] = useState("");

  const [mediaReplaceOpen, setMediaReplaceOpen] = useState(false);
  const [mediaReplaceId, setMediaReplaceId] = useState<string | null>(null);
  const [mediaReplaceFile, setMediaReplaceFile] = useState<File | null>(null);

  const [mediaDeleteOpen, setMediaDeleteOpen] = useState(false);
  const [mediaDeleteId, setMediaDeleteId] = useState<string | null>(null);

  const [awardsLoading, setAwardsLoading] = useState(false);
  const [awardRows, setAwardRows] = useState<HorseAward[]>([]);
  const [awardDialogOpen, setAwardDialogOpen] = useState(false);
  const [awardEditingId, setAwardEditingId] = useState<string | null>(null);
  const [awardDeleteOpen, setAwardDeleteOpen] = useState(false);
  const [awardDeleteId, setAwardDeleteId] = useState<string | null>(null);
  const [awardFormError, setAwardFormError] = useState<string | null>(null);
  const [awardForm, setAwardForm] = useState({ year: "", eventName: "", title: "", placing: "", location: "", notes: "" });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<{
    slug: string; category: HorseCategory; isActive: boolean;
    birthDate: string; color: string; heightCm: string;
    breeder: string; owner: string; notes: string; translations: TranslationsForm;
  }>({
    slug: "", category: "stallion", isActive: true, birthDate: "",
    color: "", heightCm: "", breeder: "", owner: "", notes: "", translations: emptyTranslations(),
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchHorseById(id);
      setItem(next);
      setCoverFile(null);
      setForm({
        slug: next.slug, category: next.category, isActive: next.isActive !== false,
        birthDate: next.birthDate ?? "", color: next.color ?? "",
        heightCm: typeof next.heightCm === "number" ? String(next.heightCm) : "",
        breeder: next.breeder ?? "", owner: next.owner ?? "",
        notes: next.notes ?? "", translations: translationsFromItem(next),
      });
    } catch (e) {
      toastApiError(e, t("loadError"));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  const loadMedia = useCallback(async () => {
    setMediaLoading(true);
    try { setMediaRows(await fetchHorseMedia(id)); }
    catch (e) { toastApiError(e, tMedia("loadError")); setMediaRows([]); }
    finally { setMediaLoading(false); }
  }, [id, tMedia]);

  const loadAwards = useCallback(async () => {
    setAwardsLoading(true);
    try { setAwardRows(await fetchHorseAwards(id)); }
    catch (e) { toastApiError(e, tAwards("loadError")); setAwardRows([]); }
    finally { setAwardsLoading(false); }
  }, [id, tAwards]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!id) return; void loadMedia(); void loadAwards(); }, [id, loadMedia, loadAwards]);

  function openViewer(index: number) {
    setViewerIndex(Math.max(0, Math.min(mediaRows.length - 1, index)));
    setViewerOpen(true);
  }

  function moveMedia(index: number, direction: -1 | 1) {
    setMediaRows((prev) => {
      const next = [...prev];
      const to = index + direction;
      if (index < 0 || index >= next.length || to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  async function persistMediaOrder() {
    try {
      await reorderHorseMedia(id, mediaRows.map((m, idx) => ({ id: m.id, sortOrder: idx * 10 })));
      toast.success(tMedia("reorderSuccess"));
      await loadMedia();
      setMediaReorderMode(false);
    } catch (e) { toastApiError(e, tMedia("reorderError")); }
  }

  async function onUploadMedia() {
    if (!mediaUploadFile) { toast.error(tMedia("fileRequired")); return; }
    setSubmitting(true);
    try {
      await addHorseMedia(id, {
        file: mediaUploadFile,
        caption: mediaUploadCaption.trim() || undefined,
        sortOrder: mediaUploadSortOrder.trim() ? Number(mediaUploadSortOrder) : undefined,
      });
      toast.success(tMedia("uploadSuccess"));
      setMediaUploadOpen(false);
      setMediaUploadFile(null); setMediaUploadCaption(""); setMediaUploadSortOrder("");
      await loadMedia();
    } catch (e) { toastApiError(e, tMedia("uploadError")); }
    finally { setSubmitting(false); }
  }

  async function onReplaceMediaFile() {
    if (!mediaReplaceId || !mediaReplaceFile) { toast.error(tMedia("fileRequired")); return; }
    setSubmitting(true);
    try {
      await replaceHorseMediaFile(id, mediaReplaceId, mediaReplaceFile);
      toast.success(tMedia("replaceSuccess"));
      setMediaReplaceOpen(false); setMediaReplaceId(null); setMediaReplaceFile(null);
      await loadMedia();
    } catch (e) { toastApiError(e, tMedia("replaceError")); }
    finally { setSubmitting(false); }
  }

  async function onUpdateMediaMeta() {
    if (!mediaEditId) return;
    setSubmitting(true);
    try {
      await updateHorseMediaMeta(id, mediaEditId, {
        caption: mediaEditCaption.trim() || undefined,
        sortOrder: mediaEditSortOrder.trim() ? Number(mediaEditSortOrder) : undefined,
      });
      toast.success(tMedia("editSuccess"));
      setMediaEditOpen(false); setMediaEditId(null); setMediaEditCaption(""); setMediaEditSortOrder("");
      await loadMedia();
    } catch (e) { toastApiError(e, tMedia("editError")); }
    finally { setSubmitting(false); }
  }

  async function onDeleteMedia() {
    if (!mediaDeleteId) return;
    setSubmitting(true);
    try {
      await deleteHorseMedia(id, mediaDeleteId);
      toast.success(tMedia("deleteSuccess"));
      setMediaDeleteOpen(false); setMediaDeleteId(null);
      await loadMedia();
    } catch (e) { toastApiError(e, tMedia("deleteError")); }
    finally { setSubmitting(false); }
  }

  function openAwardCreate() {
    setAwardFormError(null); setAwardEditingId(null);
    setAwardForm({ year: "", eventName: "", title: "", placing: "", location: "", notes: "" });
    setAwardDialogOpen(true);
  }

  function openAwardEdit(a: HorseAward) {
    setAwardFormError(null); setAwardEditingId(a.id);
    setAwardForm({ year: String(a.year), eventName: a.eventName ?? "", title: a.title ?? "", placing: a.placing ?? "", location: a.location ?? "", notes: a.notes ?? "" });
    setAwardDialogOpen(true);
  }

  async function onSaveAward() {
    setAwardFormError(null);
    if (!awardSchema.safeParse(awardForm).success) { setAwardFormError(tAwards("invalid")); return; }
    setSubmitting(true);
    try {
      const payload = {
        year: Number(awardForm.year), eventName: awardForm.eventName.trim(),
        title: awardForm.title.trim(), placing: awardForm.placing.trim() || null,
        location: awardForm.location.trim() || null, notes: awardForm.notes.trim() || null,
      };
      if (awardEditingId) { await updateHorseAward(id, awardEditingId, payload); toast.success(tAwards("updateSuccess")); }
      else { await createHorseAward(id, payload); toast.success(tAwards("createSuccess")); }
      setAwardDialogOpen(false);
      await loadAwards();
    } catch (e) { toastApiError(e, awardEditingId ? tAwards("updateError") : tAwards("createError")); }
    finally { setSubmitting(false); }
  }

  async function onDeleteAward() {
    if (!awardDeleteId) return;
    setSubmitting(true);
    try {
      await deleteHorseAward(id, awardDeleteId);
      toast.success(tAwards("deleteSuccess"));
      setAwardDeleteOpen(false); setAwardDeleteId(null);
      await loadAwards();
    } catch (e) { toastApiError(e, tAwards("deleteError")); }
    finally { setSubmitting(false); }
  }

  const saveDisabled = useMemo(() => {
    const ok = updateSchema.safeParse({ slug: form.slug, category: form.category, isActive: form.isActive }).success;
    return submitting || !ok || !hasBothLocalesRequired(form.translations);
  }, [form, submitting]);

  async function onSave() {
    setFormError(null);
    const ok = updateSchema.safeParse({ slug: form.slug, category: form.category, isActive: form.isActive });
    if (!ok.success || !hasBothLocalesRequired(form.translations)) { setFormError(t("invalid")); return; }
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
      const updated = await updateHorse(id, fd);
      setItem(updated);
      toast.success(t("saveSuccess"));
      setEditOpen(false); setCoverFile(null);
      await load();
    } catch (e) { toastApiError(e, t("saveError")); }
    finally { setSubmitting(false); }
  }

  async function onDelete() {
    setSubmitting(true);
    try {
      await deleteHorse(id);
      toast.success(t("deleteSuccess"));
      router.replace("/horses");
    } catch (e) { toastApiError(e, t("deleteError")); }
    finally { setSubmitting(false); setDeleteOpen(false); }
  }

  const title = item ? pickBestName(item, locale).name : "—";
  const subtitle = item ? pickBestName(item, locale).subtitle : "";
  const cover = item?.coverImage?.trim() ? normalizeHorseCoverImagePath(item.coverImage) : null;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button" variant="ghost" size="sm"
          className="gap-1.5 -ms-2 text-muted-foreground hover:text-foreground"
          nativeButton={false}
          render={<Link href="/horses"><ArrowLeft className="size-4 rtl:rotate-180" />{t("back")}</Link>}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button" variant="outline" size="sm"
            className="gap-1.5" disabled={loading || !item}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-3.5" /><span className="hidden sm:inline">{t("edit")}</span>
          </Button>
          <Button
            type="button" variant="destructive" size="sm"
            className="gap-1.5" disabled={loading || !item}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" /><span className="hidden sm:inline">{t("delete")}</span>
          </Button>
        </div>
      </div>

      {/* ── Hero card ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <Skeleton className="h-48 w-full sm:h-56" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </div>
          </div>
        </div>
      ) : !item ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-20 text-center">
          <ChessKnight className="mx-auto size-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium">{t("notFound")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("notFoundHint")}</p>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
            {/* Cover image */}
            <div className="relative h-44 bg-muted sm:h-56">
              {cover ? (
                <img src={cover} alt={title} className="h-full w-full object-cover" loading="lazy" decoding="async"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="size-10 text-muted-foreground/20" />
                </div>
              )}
              {/* Status overlay */}
              <div className="absolute right-3 top-3">
                {item.isActive !== false ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />{tList("active")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-2.5 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                    <XCircle className="size-3" />{tList("inactive")}
                  </span>
                )}
              </div>
            </div>

            {/* Identity */}
            <div className="border-b border-border/60 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h1>
                  {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="rounded-full font-normal">
                      {categoryLabel(tList, item.category)}
                    </Badge>
                    <StatBadge>{item.slug}</StatBadge>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick stats grid */}
            <div className="grid grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4">
              {[
                { icon: Calendar, label: t("fieldBirthDate"), value: item.birthDate },
                { icon: Ruler, label: t("fieldHeightCm"), value: typeof item.heightCm === "number" ? `${item.heightCm} cm` : null },
                { icon: Palette, label: t("fieldColor"), value: item.color },
                { icon: User, label: t("fieldOwner"), value: item.owner },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2.5 px-4 py-3">
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">{label}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value ?? "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Media Gallery ─────────────────────────────────────────────────── */}
          <Section
            icon={Images}
            title={tMedia("title")}
            description={tMedia("description")}
            badge={<StatBadge>{mediaLoading ? "…" : mediaRows.length}</StatBadge>}
            actions={
              <>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                  disabled={mediaLoading || submitting} onClick={() => void loadMedia()}>
                  <RefreshCw className={cn("size-3.5", mediaLoading && "animate-spin")} />
                </Button>
                {mediaReorderMode ? (
                  <>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
                      onClick={() => setMediaReorderMode(false)}>
                      {tMedia("done")}
                    </Button>
                    <Button type="button" size="sm" className="h-8 text-xs"
                      disabled={submitting || mediaRows.length < 2}
                      onClick={() => void persistMediaOrder()}>
                      {tMedia("saveOrder")}
                    </Button>
                  </>
                ) : (
                  <>
                    {mediaRows.length >= 2 && (
                      <Button type="button" variant="outline" size="sm" className="h-8 text-xs"
                        disabled={submitting} onClick={() => setMediaReorderMode(true)}>
                        {tMedia("reorder")}
                      </Button>
                    )}
                    <Button type="button" size="sm" className="h-8 gap-1.5 text-xs"
                      disabled={submitting} onClick={() => setMediaUploadOpen(true)}>
                      <Plus className="size-3" />{tMedia("upload")}
                    </Button>
                  </>
                )}
              </>
            }
          >
            {mediaLoading ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
                ))}
              </div>
            ) : mediaRows.length === 0 ? (
              <button type="button" onClick={() => setMediaUploadOpen(true)}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 py-10 text-center transition-colors hover:bg-muted/40 hover:border-border">
                <div className="flex size-10 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
                  <Upload className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tMedia("empty")}</p>
                  <p className="text-xs text-muted-foreground">{tMedia("emptyHint")}</p>
                </div>
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {mediaRows.map((m, idx) => (
                  <div key={m.id} className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted">
                    <button type="button" className="relative block aspect-[4/3] w-full overflow-hidden"
                      onClick={() => openViewer(idx)}>
                      <img src={m.url} alt={m.caption ?? ""} loading="lazy" decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/0 transition-all duration-200 group-hover:bg-black/30 flex items-center justify-center">
                        <Eye className="size-5 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 drop-shadow" />
                      </div>
                    </button>

                    {mediaReorderMode ? (
                      <div className="flex items-center justify-between gap-1 border-t border-border/60 bg-background px-2 py-1.5">
                        <Button type="button" size="icon" variant="outline" className="h-6 w-6"
                          disabled={idx === 0 || submitting} onClick={() => moveMedia(idx, -1)}>
                          <ArrowUp className="size-3" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground">{idx * 10}</span>
                        <Button type="button" size="icon" variant="outline" className="h-6 w-6"
                          disabled={idx === mediaRows.length - 1 || submitting} onClick={() => moveMedia(idx, 1)}>
                          <ArrowDown className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 border-t border-border/60 bg-background p-1.5">
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={submitting}
                          onClick={() => { setMediaEditId(m.id); setMediaEditCaption(m.caption ?? ""); setMediaEditSortOrder(typeof m.sortOrder === "number" ? String(m.sortOrder) : ""); setMediaEditOpen(true); }}>
                          <PencilLine className="size-3" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" disabled={submitting}
                          onClick={() => { setMediaReplaceId(m.id); setMediaReplaceFile(null); setMediaReplaceOpen(true); }}>
                          <Upload className="size-3" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="ms-auto h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={submitting}
                          onClick={() => { setMediaDeleteId(m.id); setMediaDeleteOpen(true); }}>
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Awards ────────────────────────────────────────────────────────── */}
          <Section
            icon={Award}
            title={tAwards("title")}
            description={tAwards("description")}
            badge={<StatBadge>{awardsLoading ? "…" : awardRows.length}</StatBadge>}
            actions={
              <>
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0"
                  disabled={awardsLoading || submitting} onClick={() => void loadAwards()}>
                  <RefreshCw className={cn("size-3.5", awardsLoading && "animate-spin")} />
                </Button>
                <Button type="button" size="sm" className="h-8 gap-1.5 text-xs"
                  disabled={submitting} onClick={openAwardCreate}>
                  <Plus className="size-3" />{tAwards("add")}
                </Button>
              </>
            }
          >
            {awardsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : awardRows.length === 0 ? (
              <button type="button" onClick={openAwardCreate}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 py-10 text-center transition-colors hover:bg-muted/40 hover:border-border">
                <div className="flex size-10 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
                  <Award className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{tAwards("empty")}</p>
                  <p className="text-xs text-muted-foreground">{tAwards("emptyHint")}</p>
                </div>
              </button>
            ) : (
              <div className="space-y-2">
                {awardRows.map((a) => (
                  <div key={a.id} className="group flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background px-4 py-3 transition-colors hover:bg-muted/30">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/50 text-xs font-bold text-muted-foreground">
                        {a.year}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{a.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {a.eventName}{a.location ? ` · ${a.location}` : ""}{a.placing ? ` · ${a.placing}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => openAwardEdit(a)} disabled={submitting}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={submitting}
                        onClick={() => { setAwardDeleteId(a.id); setAwardDeleteOpen(true); }}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* ── Translations ──────────────────────────────────────────────────── */}
          <Section icon={Globe} title={t("translationsLabel")}
            badge={
              <div className="flex gap-1">
                {(["en", "ar"] as const).map((loc) => (
                  <span key={loc} className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    item.translations.some((x) => x.locale === loc)
                      ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>{loc}</span>
                ))}
              </div>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {(["en", "ar"] as const).map((loc) => {
                const tr = item.translations.find((x) => x.locale === loc) ?? null;
                const dir = loc === "ar" ? "rtl" : "ltr";
                return (
                  <div key={loc} className="rounded-xl border border-border/60 bg-background p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold text-foreground">
                        {loc === "en" ? t("langEn") : t("langAr")}
                      </p>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        tr ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>{loc}</span>
                    </div>
                    <div className="space-y-3" dir={dir}>
                      <InfoField label={t("fieldName")} value={tr?.name?.trim() ? tr.name : undefined} dir={dir} />
                      <InfoField label={t("fieldSubtitle")} value={tr?.subtitle?.trim() ? tr.subtitle : undefined} dir={dir} />
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{t("fieldShortBio")}</p>
                        <p className="whitespace-pre-wrap text-sm text-foreground" dir={dir}>{tr?.shortBio?.trim() ? tr.shortBio : "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{t("fieldTags")}</p>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {(tr?.tags ?? []).length ? tr!.tags.map((tag, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{tag}</span>
                          )) : <span className="text-sm text-muted-foreground">—</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      )}

      {/* ══ DIALOGS ════════════════════════════════════════════════════════════ */}

      {/* Edit */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[92dvh] overflow-hidden flex flex-col sm:max-w-[700px]">
          <DialogHeader className="shrink-0 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <Pencil className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogEditTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogEditDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-5 py-4 pr-1">
              {formError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{formError}</p>}

              {/* Base fields */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("sectionBase")}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldSlug")}</Label>
                    <Input value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} className="h-9" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldCategory")}</Label>
                    <select
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={form.category}
                      onChange={(e) => setForm((s) => ({ ...s, category: e.target.value as HorseCategory }))}>
                      {categories.map((c) => <option key={c} value={c}>{categoryLabel(tList, c)}</option>)}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldBirthDate")}</Label>
                    <Input type="date" value={form.birthDate} className="h-9"
                      onChange={(e) => setForm((s) => ({ ...s, birthDate: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldHeightCm")}</Label>
                    <Input inputMode="numeric" value={form.heightCm} className="h-9"
                      onChange={(e) => setForm((s) => ({ ...s, heightCm: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldColor")}</Label>
                    <Input value={form.color} className="h-9"
                      onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldOwner")}</Label>
                    <Input value={form.owner} className="h-9"
                      onChange={(e) => setForm((s) => ({ ...s, owner: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldBreeder")}</Label>
                    <Input value={form.breeder} className="h-9"
                      onChange={(e) => setForm((s) => ({ ...s, breeder: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldNotes")}</Label>
                    <Input value={form.notes} className="h-9"
                      onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                    <p className="text-xs text-muted-foreground">{form.isActive ? tList("active") : tList("inactive")}</p>
                  </div>
                  <Switch checked={form.isActive} onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
                </div>
              </div>

              {/* Cover image */}
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("fieldCoverImage")}</Label>
                <label htmlFor="horse-cover-edit"
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
                  <Input id="horse-cover-edit" type="file" accept="image/*" className="sr-only"
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
                          { key: "tags" as const, label: t("fieldTags"), type: "input" },
                        ].map(({ key, label, type, rows }) => (
                          <div key={key} className="grid gap-1.5">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</Label>
                            {type === "textarea" ? (
                              <Textarea dir={dir} rows={rows} value={v[key]}
                                className="resize-none text-sm"
                                onChange={(e) => setForm((s) => ({ ...s, translations: { ...s.translations, [loc]: { ...s.translations[loc], [key]: e.target.value } } }))} />
                            ) : (
                              <Input dir={dir} value={v[key]} className="h-9"
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
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
            <Button type="button" disabled={saveDisabled} onClick={() => void onSave()} className="gap-1.5 min-w-24">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox viewer */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[96vw] gap-3 p-3 sm:max-w-[860px]">
          <div className="relative overflow-hidden rounded-xl border border-border/60 bg-muted">
            {mediaRows[viewerIndex] ? (
              <img src={mediaRows[viewerIndex]!.url} alt={mediaRows[viewerIndex]!.caption ?? ""}
                className="max-h-[75dvh] w-full object-contain" decoding="async" />
            ) : (
              <div className="flex h-64 items-center justify-center">
                <ImageIcon className="size-8 text-muted-foreground/30" />
              </div>
            )}
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <Button type="button" size="icon" variant="secondary" className="h-8 w-8 shadow-md"
                disabled={viewerIndex <= 0} onClick={() => setViewerIndex((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="size-4 rtl:rotate-180" />
              </Button>
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Button type="button" size="icon" variant="secondary" className="h-8 w-8 shadow-md"
                disabled={viewerIndex >= mediaRows.length - 1}
                onClick={() => setViewerIndex((i) => Math.min(mediaRows.length - 1, i + 1))}>
                <ChevronRight className="size-4 rtl:rotate-180" />
              </Button>
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                {viewerIndex + 1} / {mediaRows.length}
              </span>
            </div>
          </div>
          {mediaRows[viewerIndex]?.caption && (
            <p className="px-1 text-sm text-muted-foreground">{mediaRows[viewerIndex]!.caption}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Media upload */}
      <Dialog open={mediaUploadOpen} onOpenChange={setMediaUploadOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted"><Upload className="size-3.5 text-muted-foreground" /></div>
              {tMedia("uploadTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tMedia("uploadDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tMedia("file")}</Label>
              <Input type="file" accept="image/*" className="h-9" onChange={(e) => setMediaUploadFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tMedia("caption")}</Label>
              <Input value={mediaUploadCaption} className="h-9" onChange={(e) => setMediaUploadCaption(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tMedia("sortOrder")}</Label>
              <Input inputMode="numeric" value={mediaUploadSortOrder} placeholder="0" className="h-9" onChange={(e) => setMediaUploadSortOrder(e.target.value)} />
            </div>
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setMediaUploadOpen(false)}>{tMedia("cancel")}</Button>
            <Button type="button" disabled={submitting} onClick={() => void onUploadMedia()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {tMedia("upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media edit */}
      <Dialog open={mediaEditOpen} onOpenChange={setMediaEditOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted"><PencilLine className="size-3.5 text-muted-foreground" /></div>
              {tMedia("editTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tMedia("editDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tMedia("caption")}</Label>
              <Input value={mediaEditCaption} className="h-9" onChange={(e) => setMediaEditCaption(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tMedia("sortOrder")}</Label>
              <Input inputMode="numeric" value={mediaEditSortOrder} placeholder="0" className="h-9" onChange={(e) => setMediaEditSortOrder(e.target.value)} />
            </div>
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setMediaEditOpen(false)}>{tMedia("cancel")}</Button>
            <Button type="button" disabled={submitting} onClick={() => void onUpdateMediaMeta()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <PencilLine className="size-3.5" />}
              {tMedia("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media replace */}
      <Dialog open={mediaReplaceOpen} onOpenChange={setMediaReplaceOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted"><Upload className="size-3.5 text-muted-foreground" /></div>
              {tMedia("replaceTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tMedia("replaceDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tMedia("file")}</Label>
              <Input type="file" accept="image/*" className="h-9" onChange={(e) => setMediaReplaceFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setMediaReplaceOpen(false)}>{tMedia("cancel")}</Button>
            <Button type="button" disabled={submitting} onClick={() => void onReplaceMediaFile()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {tMedia("replace")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media delete */}
      <Dialog open={mediaDeleteOpen} onOpenChange={setMediaDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
                <Trash2 className="size-3.5 text-destructive" />
              </div>
              {tMedia("deleteTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tMedia("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setMediaDeleteOpen(false)}>{tMedia("cancel")}</Button>
            <Button type="button" variant="destructive" disabled={submitting} onClick={() => void onDeleteMedia()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {tMedia("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award create/edit */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted"><Award className="size-3.5 text-muted-foreground" /></div>
              {awardEditingId ? tAwards("editTitle") : tAwards("createTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{awardEditingId ? tAwards("editDescription") : tAwards("createDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-1">
            {awardFormError && <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{awardFormError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tAwards("fieldYear")}</Label>
                <Input inputMode="numeric" value={awardForm.year} placeholder="2026" className="h-9"
                  onChange={(e) => setAwardForm((s) => ({ ...s, year: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tAwards("fieldEventName")}</Label>
                <Input value={awardForm.eventName} className="h-9"
                  onChange={(e) => setAwardForm((s) => ({ ...s, eventName: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tAwards("fieldTitle")}</Label>
              <Input value={awardForm.title} className="h-9" onChange={(e) => setAwardForm((s) => ({ ...s, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tAwards("fieldPlacing")}</Label>
                <Input value={awardForm.placing} className="h-9" onChange={(e) => setAwardForm((s) => ({ ...s, placing: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tAwards("fieldLocation")}</Label>
                <Input value={awardForm.location} className="h-9" onChange={(e) => setAwardForm((s) => ({ ...s, location: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tAwards("fieldNotes")}</Label>
              <Textarea value={awardForm.notes} rows={3} className="resize-none text-sm"
                onChange={(e) => setAwardForm((s) => ({ ...s, notes: e.target.value }))} />
            </div>
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setAwardDialogOpen(false)}>{tAwards("cancel")}</Button>
            <Button type="button" disabled={submitting} onClick={() => void onSaveAward()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
              {awardEditingId ? tAwards("save") : tAwards("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award delete */}
      <Dialog open={awardDeleteOpen} onOpenChange={setAwardDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
                <Trash2 className="size-3.5 text-destructive" />
              </div>
              {tAwards("deleteTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tAwards("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setAwardDeleteOpen(false)}>{tAwards("cancel")}</Button>
            <Button type="button" variant="destructive" disabled={submitting} onClick={() => void onDeleteAward()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {tAwards("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Horse delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
                <Trash2 className="size-3.5 text-destructive" />
              </div>
              {t("dialogDeleteTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogDeleteDescription")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{item?.slug ?? ""}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setDeleteOpen(false)}>{t("cancel")}</Button>
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