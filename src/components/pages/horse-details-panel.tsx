"use client";

import {
  ArrowLeft,
  Trophy,
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

type TranslationsForm = Record<
  HorseLocale,
  {
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
  }
>;

function emptyTranslations(): TranslationsForm {
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

function translationsFromItem(item: HorseDetails): TranslationsForm {
  const base = emptyTranslations();
  for (const tr of item.translations ?? []) {
    if (tr.locale !== "en" && tr.locale !== "ar") continue;
    base[tr.locale] = {
      name: tr.name ?? "",
      subtitle: tr.subtitle ?? "",
      shortBio: tr.shortBio ?? "",
      description: (tr.description ?? "") || "",
      tags: (tr.tags ?? []).join(", "),
      metaTitle: (tr.metaTitle ?? "") || "",
      metaDescription: (tr.metaDescription ?? "") || "",
      sireName: (tr.sireName ?? "") || "",
      damName: (tr.damName ?? "") || "",
      bloodline: (tr.bloodline ?? "") || "",
    };
  }
  return base;
}

function hasBothLocalesRequired(tr: TranslationsForm): boolean {
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

const updateSchema = z.object({
  slug: z.string().trim().min(1, { message: "required" }),
  category: z.enum(categories),
  isActive: z.boolean(),
});

const awardSchema = z.object({
  year: z
    .string()
    .trim()
    .min(4, { message: "required" })
    .refine((v) => Number.isFinite(Number(v)), { message: "required" }),
  eventName: z.string().trim().min(1, { message: "required" }),
  title: z.string().trim().min(1, { message: "required" }),
  placing: z.string().trim().optional(),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

function pickBestName(item: HorseDetails, locale: string): { name: string; subtitle: string } {
  const want = locale === "ar" ? "ar" : "en";
  const exact = item.translations?.find((t) => t.locale === want);
  const fallback = item.translations?.find((t) => t.locale === "en") ?? item.translations?.[0];
  const t = exact ?? fallback ?? null;
  return {
    name: t?.name?.trim() ? t.name : "—",
    subtitle: t?.subtitle ?? "",
  };
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
  const [awardForm, setAwardForm] = useState({
    year: "",
    eventName: "",
    title: "",
    placing: "",
    location: "",
    notes: "",
  });

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
    translations: TranslationsForm;
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
      const next = await fetchHorseById(id);
      setItem(next);
      setCoverFile(null);
      setForm({
        slug: next.slug,
        category: next.category,
        isActive: next.isActive !== false,
        birthDate: next.birthDate ?? "",
        color: next.color ?? "",
        heightCm: typeof next.heightCm === "number" ? String(next.heightCm) : "",
        breeder: next.breeder ?? "",
        owner: next.owner ?? "",
        notes: next.notes ?? "",
        translations: translationsFromItem(next),
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
    try {
      const rows = await fetchHorseMedia(id);
      setMediaRows(rows);
    } catch (e) {
      toastApiError(e, tMedia("loadError"));
      setMediaRows([]);
    } finally {
      setMediaLoading(false);
    }
  }, [id, tMedia]);

  const loadAwards = useCallback(async () => {
    setAwardsLoading(true);
    try {
      const rows = await fetchHorseAwards(id);
      setAwardRows(rows);
    } catch (e) {
      toastApiError(e, tAwards("loadError"));
      setAwardRows([]);
    } finally {
      setAwardsLoading(false);
    }
  }, [id, tAwards]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!id) return;
    void loadMedia();
    void loadAwards();
  }, [id, loadMedia, loadAwards]);

  function openViewer(index: number) {
    setViewerIndex(Math.max(0, Math.min(mediaRows.length - 1, index)));
    setViewerOpen(true);
  }

  function moveMedia(index: number, direction: -1 | 1) {
    setMediaRows((prev) => {
      const next = [...prev];
      const to = index + direction;
      if (index < 0 || index >= next.length) return prev;
      if (to < 0 || to >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[to];
      next[to] = tmp;
      return next;
    });
  }

  async function persistMediaOrder() {
    try {
      const items = mediaRows.map((m, idx) => ({ id: m.id, sortOrder: idx * 10 }));
      await reorderHorseMedia(id, items);
      toast.success(tMedia("reorderSuccess"));
      await loadMedia();
      setMediaReorderMode(false);
    } catch (e) {
      toastApiError(e, tMedia("reorderError"));
    }
  }

  async function onUploadMedia() {
    if (!mediaUploadFile) {
      toast.error(tMedia("fileRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await addHorseMedia(id, {
        file: mediaUploadFile,
        caption: mediaUploadCaption.trim() ? mediaUploadCaption.trim() : undefined,
        sortOrder: mediaUploadSortOrder.trim()
          ? Number(mediaUploadSortOrder)
          : undefined,
      });
      toast.success(tMedia("uploadSuccess"));
      setMediaUploadOpen(false);
      setMediaUploadFile(null);
      setMediaUploadCaption("");
      setMediaUploadSortOrder("");
      await loadMedia();
    } catch (e) {
      toastApiError(e, tMedia("uploadError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onReplaceMediaFile() {
    if (!mediaReplaceId || !mediaReplaceFile) {
      toast.error(tMedia("fileRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await replaceHorseMediaFile(id, mediaReplaceId, mediaReplaceFile);
      toast.success(tMedia("replaceSuccess"));
      setMediaReplaceOpen(false);
      setMediaReplaceId(null);
      setMediaReplaceFile(null);
      await loadMedia();
    } catch (e) {
      toastApiError(e, tMedia("replaceError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onUpdateMediaMeta() {
    if (!mediaEditId) return;
    setSubmitting(true);
    try {
      await updateHorseMediaMeta(id, mediaEditId, {
        caption: mediaEditCaption.trim() ? mediaEditCaption.trim() : undefined,
        sortOrder: mediaEditSortOrder.trim()
          ? Number(mediaEditSortOrder)
          : undefined,
      });
      toast.success(tMedia("editSuccess"));
      setMediaEditOpen(false);
      setMediaEditId(null);
      setMediaEditCaption("");
      setMediaEditSortOrder("");
      await loadMedia();
    } catch (e) {
      toastApiError(e, tMedia("editError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteMedia() {
    if (!mediaDeleteId) return;
    setSubmitting(true);
    try {
      await deleteHorseMedia(id, mediaDeleteId);
      toast.success(tMedia("deleteSuccess"));
      setMediaDeleteOpen(false);
      setMediaDeleteId(null);
      await loadMedia();
    } catch (e) {
      toastApiError(e, tMedia("deleteError"));
    } finally {
      setSubmitting(false);
    }
  }

  function openAwardCreate() {
    setAwardFormError(null);
    setAwardEditingId(null);
    setAwardForm({
      year: "",
      eventName: "",
      title: "",
      placing: "",
      location: "",
      notes: "",
    });
    setAwardDialogOpen(true);
  }

  function openAwardEdit(a: HorseAward) {
    setAwardFormError(null);
    setAwardEditingId(a.id);
    setAwardForm({
      year: String(a.year),
      eventName: a.eventName ?? "",
      title: a.title ?? "",
      placing: a.placing ?? "",
      location: a.location ?? "",
      notes: a.notes ?? "",
    });
    setAwardDialogOpen(true);
  }

  async function onSaveAward() {
    setAwardFormError(null);
    const parsed = awardSchema.safeParse(awardForm);
    if (!parsed.success) {
      setAwardFormError(tAwards("invalid"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        year: Number(awardForm.year),
        eventName: awardForm.eventName.trim(),
        title: awardForm.title.trim(),
        placing: awardForm.placing.trim() || null,
        location: awardForm.location.trim() || null,
        notes: awardForm.notes.trim() || null,
      };
      if (awardEditingId) {
        await updateHorseAward(id, awardEditingId, payload);
        toast.success(tAwards("updateSuccess"));
      } else {
        await createHorseAward(id, payload);
        toast.success(tAwards("createSuccess"));
      }
      setAwardDialogOpen(false);
      await loadAwards();
    } catch (e) {
      toastApiError(
        e,
        awardEditingId ? tAwards("updateError") : tAwards("createError")
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteAward() {
    if (!awardDeleteId) return;
    setSubmitting(true);
    try {
      await deleteHorseAward(id, awardDeleteId);
      toast.success(tAwards("deleteSuccess"));
      setAwardDeleteOpen(false);
      setAwardDeleteId(null);
      await loadAwards();
    } catch (e) {
      toastApiError(e, tAwards("deleteError"));
    } finally {
      setSubmitting(false);
    }
  }

  const saveDisabled = useMemo(() => {
    const ok = updateSchema.safeParse({
      slug: form.slug,
      category: form.category,
      isActive: form.isActive,
    }).success;
    return submitting || !ok || !hasBothLocalesRequired(form.translations);
  }, [form, submitting]);

  async function onSave() {
    setFormError(null);
    const ok = updateSchema.safeParse({
      slug: form.slug,
      category: form.category,
      isActive: form.isActive,
    });
    if (!ok.success || !hasBothLocalesRequired(form.translations)) {
      setFormError(t("invalid"));
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

      const updated = await updateHorse(id, fd);
      setItem(updated);
      toast.success(t("saveSuccess"));
      setEditOpen(false);
      setCoverFile(null);
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
      await deleteHorse(id);
      toast.success(t("deleteSuccess"));
      router.replace("/horses");
    } catch (e) {
      toastApiError(e, t("deleteError"));
    } finally {
      setSubmitting(false);
      setDeleteOpen(false);
    }
  }

  const title = item ? pickBestName(item, locale).name : "—";
  const subtitle = item ? pickBestName(item, locale).subtitle : "";
  const cover =
    item?.coverImage && item.coverImage.trim()
      ? normalizeHorseCoverImagePath(item.coverImage)
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8">
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
                  <Link href="/horses">
                    <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
                    {t("back")}
                  </Link>
                }
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={loading || !item}
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-3.5" aria-hidden />
                {t("edit")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={loading || !item}
                onClick={() => setDeleteOpen(true)}
              >
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
              <Trophy className="size-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground">{t("notFound")}</p>
              <p className="text-xs text-muted-foreground">{t("notFoundHint")}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-lg border bg-muted/10 p-4 sm:grid-cols-[240px_1fr]">
                <div className="overflow-hidden rounded-lg border bg-muted">
                  {cover ? (
                    <img
                      src={cover}
                      alt={title}
                      className="h-48 w-full object-cover sm:h-full"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center sm:h-full">
                      <ImageIcon className="size-6 text-muted-foreground/40" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-normal">
                      {categoryLabel(tList, item.category)}
                    </Badge>
                    {item.isActive === false ? (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        {tList("inactive")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="font-normal">
                        {tList("active")}
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      {item.slug}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">{t("fieldBirthDate")}</p>
                      <p className="text-sm font-medium">{item.birthDate ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">{t("fieldHeightCm")}</p>
                      <p className="text-sm font-medium">
                        {typeof item.heightCm === "number" ? item.heightCm : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">{t("fieldColor")}</p>
                      <p className="text-sm font-medium">{item.color ?? "—"}</p>
                    </div>
                    <div className="rounded-lg border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">{t("fieldOwner")}</p>
                      <p className="text-sm font-medium">{item.owner ?? "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg border bg-background">
                      <Images className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{tMedia("title")}</p>
                      <p className="text-xs text-muted-foreground">{tMedia("description")}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {tMedia("count")}: {mediaLoading ? "…" : mediaRows.length}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={mediaLoading || submitting}
                      onClick={() => void loadMedia()}
                    >
                      <RefreshCw className={cn("size-3.5", mediaLoading && "animate-spin")} />
                      {tMedia("refresh")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={submitting}
                      onClick={() => setMediaUploadOpen(true)}
                    >
                      <Plus className="size-3.5" />
                      {tMedia("upload")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={submitting || mediaRows.length < 2}
                      onClick={() => setMediaReorderMode((v) => !v)}
                    >
                      {mediaReorderMode ? tMedia("done") : tMedia("reorder")}
                    </Button>
                    {mediaReorderMode ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={submitting || mediaRows.length < 2}
                        onClick={() => void persistMediaOrder()}
                      >
                        {tMedia("saveOrder")}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {mediaLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
                    ))}
                  </div>
                ) : mediaRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-10 text-center">
                    <Images className="size-8 text-muted-foreground/50" aria-hidden />
                    <p className="text-sm font-medium">{tMedia("empty")}</p>
                    <p className="text-xs text-muted-foreground">{tMedia("emptyHint")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {mediaRows.map((m, idx) => (
                      <div key={m.id} className="group overflow-hidden rounded-lg border bg-background">
                        <button
                          type="button"
                          className="relative block aspect-[4/3] w-full overflow-hidden bg-muted"
                          onClick={() => openViewer(idx)}
                        >
                          <img
                            src={m.url}
                            alt={m.caption ?? ""}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                            loading="lazy"
                            decoding="async"
                          />
                          <div className="absolute inset-0 hidden items-end justify-between bg-gradient-to-t from-black/55 to-transparent p-2 text-white group-hover:flex">
                            <span className="line-clamp-1 text-xs">{m.caption ?? ""}</span>
                            <ExternalLink className="size-3.5 opacity-90" aria-hidden />
                          </div>
                        </button>
                        <div className="flex items-center gap-1.5 border-t p-2">
                          {mediaReorderMode ? (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                disabled={idx === 0 || submitting}
                                onClick={() => moveMedia(idx, -1)}
                              >
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                disabled={idx === mediaRows.length - 1 || submitting}
                                onClick={() => moveMedia(idx, 1)}
                              >
                                <ArrowDown className="size-3.5" />
                              </Button>
                              <span className="ms-auto text-xs text-muted-foreground">
                                {tMedia("order")}: {idx * 10}
                              </span>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                disabled={submitting}
                                onClick={() => {
                                  setMediaEditId(m.id);
                                  setMediaEditCaption(m.caption ?? "");
                                  setMediaEditSortOrder(
                                    typeof m.sortOrder === "number" ? String(m.sortOrder) : ""
                                  );
                                  setMediaEditOpen(true);
                                }}
                              >
                                <PencilLine className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-7 w-7"
                                disabled={submitting}
                                onClick={() => {
                                  setMediaReplaceId(m.id);
                                  setMediaReplaceFile(null);
                                  setMediaReplaceOpen(true);
                                }}
                              >
                                <Upload className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="ms-auto h-7 w-7"
                                disabled={submitting}
                                onClick={() => {
                                  setMediaDeleteId(m.id);
                                  setMediaDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg border bg-background">
                      <Award className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{tAwards("title")}</p>
                      <p className="text-xs text-muted-foreground">{tAwards("description")}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {tAwards("count")}: {awardsLoading ? "…" : awardRows.length}
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={awardsLoading || submitting}
                      onClick={() => void loadAwards()}
                    >
                      <RefreshCw className={cn("size-3.5", awardsLoading && "animate-spin")} />
                      {tAwards("refresh")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      disabled={submitting}
                      onClick={openAwardCreate}
                    >
                      <Plus className="size-3.5" />
                      {tAwards("add")}
                    </Button>
                  </div>
                </div>

                {awardsLoading ? (
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : awardRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/20 py-10 text-center">
                    <Award className="size-8 text-muted-foreground/50" aria-hidden />
                    <p className="text-sm font-medium">{tAwards("empty")}</p>
                    <p className="text-xs text-muted-foreground">{tAwards("emptyHint")}</p>
                  </div>
                ) : (
                  <div className="divide-y overflow-hidden rounded-lg border bg-card">
                    {awardRows.map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {a.year} · {a.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.eventName}
                            {a.location ? ` · ${a.location}` : ""}
                            {a.placing ? ` · ${a.placing}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => openAwardEdit(a)}
                            disabled={submitting}
                          >
                            <Pencil className="size-3.5" />
                            {tAwards("edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="gap-1.5"
                            disabled={submitting}
                            onClick={() => {
                              setAwardDeleteId(a.id);
                              setAwardDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                            {tAwards("delete")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-3 rounded-lg border bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("translationsLabel")}
                  </p>
                  <div className="flex gap-1.5">
                    {(["en", "ar"] as const).map((loc) => (
                      <Badge
                        key={loc}
                        variant={item.translations.some((x) => x.locale === loc) ? "secondary" : "outline"}
                        className="rounded-full px-2.5 py-0.5 text-xs font-normal"
                      >
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
                        <p className="text-xs font-medium text-muted-foreground">
                          {loc === "en" ? t("langEn") : t("langAr")}
                        </p>
                        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                          {loc.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="grid gap-2">
                        <div className="rounded-lg border bg-muted/10 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{t("fieldName")}</p>
                          <p className="text-sm font-medium" dir={dir}>
                            {tr?.name?.trim() ? tr.name : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{t("fieldSubtitle")}</p>
                          <p className="text-sm" dir={dir}>
                            {tr?.subtitle?.trim() ? tr.subtitle : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{t("fieldShortBio")}</p>
                          <p className="text-sm whitespace-pre-wrap" dir={dir}>
                            {tr?.shortBio?.trim() ? tr.shortBio : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{t("fieldDescription")}</p>
                          <p className="text-sm whitespace-pre-wrap" dir={dir}>
                            {tr?.description?.trim() ? tr.description : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border bg-muted/10 px-3 py-2">
                          <p className="text-xs text-muted-foreground">{t("fieldTags")}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(tr?.tags ?? []).length ? (
                              tr!.tags.map((tag, i) => (
                                <Badge key={`${loc}-${tag}-${i}`} variant="secondary" className="font-normal">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground">—</p>
                            )}
                          </div>
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

      {/* Edit dialog */}
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
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("sectionBase")}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldSlug")}</Label>
                  <Input value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldCategory")}</Label>
                  <select
                    className={cn(
                      "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    )}
                    value={form.category}
                    onChange={(e) => setForm((s) => ({ ...s, category: e.target.value as HorseCategory }))}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel(tList, c)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldBirthDate")}</Label>
                  <Input type="date" value={form.birthDate} onChange={(e) => setForm((s) => ({ ...s, birthDate: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldHeightCm")}</Label>
                  <Input inputMode="numeric" value={form.heightCm} onChange={(e) => setForm((s) => ({ ...s, heightCm: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldColor")}</Label>
                  <Input value={form.color} onChange={(e) => setForm((s) => ({ ...s, color: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldOwner")}</Label>
                  <Input value={form.owner} onChange={(e) => setForm((s) => ({ ...s, owner: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldBreeder")}</Label>
                  <Input value={form.breeder} onChange={(e) => setForm((s) => ({ ...s, breeder: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-sm">{t("fieldNotes")}</Label>
                  <Input value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
                <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))} />
              </div>
            </div>

            <div className="grid gap-1.5 rounded-lg border bg-muted/10 p-3">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <ImageIcon className="size-3 text-muted-foreground" aria-hidden />
                {t("fieldCoverImage")}
              </Label>
              <label
                htmlFor="horse-cover-edit"
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
                  id="horse-cover-edit"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

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
                const v = form.translations[loc];
                return (
                  <div key={loc} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {loc === "en" ? t("langEn") : t("langAr")}
                      </p>
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
                              translations: { ...s.translations, [loc]: { ...s.translations[loc], name: e.target.value } },
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
                              translations: { ...s.translations, [loc]: { ...s.translations[loc], subtitle: e.target.value } },
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
                              translations: { ...s.translations, [loc]: { ...s.translations[loc], shortBio: e.target.value } },
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
                              translations: { ...s.translations, [loc]: { ...s.translations[loc], description: e.target.value } },
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
                              translations: { ...s.translations, [loc]: { ...s.translations[loc], tags: e.target.value } },
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

      {/* Media viewer (lightbox) */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-[900px]">
          <DialogHeader className="pb-1">
            <DialogTitle className="flex items-center justify-between gap-2 text-base font-semibold">
              <span className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                  <Images className="size-3.5 text-muted-foreground" aria-hidden />
                </div>
                {tMedia("viewerTitle")}
              </span>
              <Badge variant="outline" className="font-normal text-muted-foreground">
                {mediaRows.length ? `${viewerIndex + 1} / ${mediaRows.length}` : "—"}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3">
            <div className="relative overflow-hidden rounded-lg border bg-muted">
              {mediaRows[viewerIndex] ? (
                <img
                  src={mediaRows[viewerIndex]!.url}
                  alt={mediaRows[viewerIndex]!.caption ?? ""}
                  className="h-[60vh] w-full object-contain"
                  decoding="async"
                />
              ) : (
                <div className="flex h-[60vh] items-center justify-center">
                  <ImageIcon className="size-8 text-muted-foreground/40" />
                </div>
              )}
            </div>
            {mediaRows[viewerIndex]?.caption ? (
              <p className="text-sm text-muted-foreground">{mediaRows[viewerIndex]!.caption}</p>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={viewerIndex <= 0}
                onClick={() => setViewerIndex((i) => Math.max(0, i - 1))}
                className="gap-1"
              >
                <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
                {tMedia("prev")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={viewerIndex >= mediaRows.length - 1}
                onClick={() => setViewerIndex((i) => Math.min(mediaRows.length - 1, i + 1))}
                className="gap-1"
              >
                {tMedia("next")}
                <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Media upload dialog */}
      <Dialog open={mediaUploadOpen} onOpenChange={setMediaUploadOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Upload className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {tMedia("uploadTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tMedia("uploadDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">{tMedia("file")}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setMediaUploadFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">{tMedia("caption")}</Label>
              <Input value={mediaUploadCaption} onChange={(e) => setMediaUploadCaption(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">{tMedia("sortOrder")}</Label>
              <Input
                inputMode="numeric"
                value={mediaUploadSortOrder}
                onChange={(e) => setMediaUploadSortOrder(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setMediaUploadOpen(false)}>
              {tMedia("cancel")}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void onUploadMedia()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {tMedia("upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media edit dialog */}
      <Dialog open={mediaEditOpen} onOpenChange={setMediaEditOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <PencilLine className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {tMedia("editTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tMedia("editDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">{tMedia("caption")}</Label>
              <Input value={mediaEditCaption} onChange={(e) => setMediaEditCaption(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">{tMedia("sortOrder")}</Label>
              <Input
                inputMode="numeric"
                value={mediaEditSortOrder}
                onChange={(e) => setMediaEditSortOrder(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setMediaEditOpen(false)}>
              {tMedia("cancel")}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void onUpdateMediaMeta()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <PencilLine className="size-3.5" />}
              {tMedia("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media replace file dialog */}
      <Dialog open={mediaReplaceOpen} onOpenChange={setMediaReplaceOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Upload className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {tMedia("replaceTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tMedia("replaceDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label className="text-sm">{tMedia("file")}</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setMediaReplaceFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setMediaReplaceOpen(false)}>
              {tMedia("cancel")}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void onReplaceMediaFile()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {tMedia("replace")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Media delete dialog */}
      <Dialog open={mediaDeleteOpen} onOpenChange={setMediaDeleteOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {tMedia("deleteTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tMedia("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setMediaDeleteOpen(false)}>
              {tMedia("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void onDeleteMedia()}
              className="gap-1.5"
            >
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {tMedia("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award create/edit dialog */}
      <Dialog open={awardDialogOpen} onOpenChange={setAwardDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Award className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {awardEditingId ? tAwards("editTitle") : tAwards("createTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {awardEditingId ? tAwards("editDescription") : tAwards("createDescription")}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3">
            {awardFormError ? <p className="text-xs text-destructive">{awardFormError}</p> : null}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-sm">{tAwards("fieldYear")}</Label>
                <Input
                  inputMode="numeric"
                  value={awardForm.year}
                  onChange={(e) => setAwardForm((s) => ({ ...s, year: e.target.value }))}
                  placeholder="2026"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">{tAwards("fieldEventName")}</Label>
                <Input
                  value={awardForm.eventName}
                  onChange={(e) => setAwardForm((s) => ({ ...s, eventName: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">{tAwards("fieldTitle")}</Label>
              <Input value={awardForm.title} onChange={(e) => setAwardForm((s) => ({ ...s, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label className="text-sm">{tAwards("fieldPlacing")}</Label>
                <Input
                  value={awardForm.placing}
                  onChange={(e) => setAwardForm((s) => ({ ...s, placing: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-sm">{tAwards("fieldLocation")}</Label>
                <Input
                  value={awardForm.location}
                  onChange={(e) => setAwardForm((s) => ({ ...s, location: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-sm">{tAwards("fieldNotes")}</Label>
              <Textarea
                value={awardForm.notes}
                onChange={(e) => setAwardForm((s) => ({ ...s, notes: e.target.value }))}
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setAwardDialogOpen(false)}>
              {tAwards("cancel")}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void onSaveAward()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
              {awardEditingId ? tAwards("save") : tAwards("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Award delete dialog */}
      <Dialog open={awardDeleteOpen} onOpenChange={setAwardDeleteOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              {tAwards("deleteTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{tAwards("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setAwardDeleteOpen(false)}>
              {tAwards("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting}
              onClick={() => void onDeleteAward()}
              className="gap-1.5"
            >
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {tAwards("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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

