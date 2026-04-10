"use client";

import {
  ArrowLeft,
  ChessKnight,
  Pencil,
  Trash2,
  RefreshCw,
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
  Globe,
  Calendar,
  Ruler,
  Palette,
  User,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Network,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type HorsePedigree,
  type HorsePedigreeRelative,
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
import { RequiredStar } from "@/components/ui/required-star";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    color: string; breeder: string;
    sireName: string; damName: string; bloodline: string;
  }
>;

type PedigreeRelKey = "father" | "mother" | "grandfather" | "grandmother";

function emptyTranslations(): TranslationsForm {
  const empty = {
    name: "", subtitle: "", shortBio: "", description: "", tags: "",
    metaTitle: "", metaDescription: "", color: "", breeder: "",
    sireName: "", damName: "", bloodline: "",
  };
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
      color: (tr.color ?? "") || "",
      breeder: (tr.breeder ?? "") || "",
      sireName: (tr.sireName ?? "") || "", damName: (tr.damName ?? "") || "",
      bloodline: (tr.bloodline ?? "") || "",
    };
  }
  const rootColor = item.color?.trim() ?? "";
  const rootBreeder = item.breeder?.trim() ?? "";
  for (const loc of ["en", "ar"] as const) {
    if (!base[loc].color.trim() && rootColor) {
      base[loc] = { ...base[loc], color: rootColor };
    }
    if (!base[loc].breeder.trim() && rootBreeder) {
      base[loc] = { ...base[loc], breeder: rootBreeder };
    }
  }
  return base;
}

function clonePedigree(p: HorsePedigree | null | undefined): HorsePedigree {
  if (!p) return {};
  const copy: HorsePedigree = {};
  for (const k of ["father", "mother", "grandfather", "grandmother"] as const) {
    const r = p[k];
    if (r) copy[k] = { name: r.name, birthDate: r.birthDate, color: r.color };
  }
  return copy;
}

function pedigreeHasContent(p: HorsePedigree | null | undefined): boolean {
  if (!p) return false;
  for (const k of ["father", "mother", "grandfather", "grandmother"] as const) {
    const r = p[k];
    if (r && (String(r.name ?? "").trim() || String(r.birthDate ?? "").trim() || String(r.color ?? "").trim())) {
      return true;
    }
  }
  return false;
}

function serializePedigreeForPatch(draft: HorsePedigree, previous: HorsePedigree | null | undefined): string | undefined {
  if (!pedigreeHasContent(draft)) {
    if (pedigreeHasContent(previous)) return "{}";
    return undefined;
  }
  const out: HorsePedigree = {};
  for (const k of ["father", "mother", "grandfather", "grandmother"] as const) {
    const r = draft[k];
    if (r && (String(r.name ?? "").trim() || String(r.birthDate ?? "").trim() || String(r.color ?? "").trim())) {
      out[k] = {
        name: String(r.name ?? "").trim() || null,
        birthDate: String(r.birthDate ?? "").trim() || null,
        color: String(r.color ?? "").trim() || null,
      };
    }
  }
  return JSON.stringify(out);
}

/** Normalize stored pedigree birthDate for `<input type="date">` (YYYY-MM-DD). */
function pedigreeBirthDateForDateInput(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return "";
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  if (Number.isNaN(t)) return "";
  return new Date(t).toISOString().slice(0, 10);
}

function PedigreeReadonlyCards({
  pedigree,
  labels,
}: {
  pedigree: HorsePedigree | null | undefined;
  labels: { father: string; mother: string; grandfather: string; grandmother: string; birthDate: string; color: string };
}) {
  if (!pedigree || !pedigreeHasContent(pedigree)) return null;
  const rows: { key: PedigreeRelKey; title: string; rel: HorsePedigreeRelative | null | undefined }[] = [
    { key: "father", title: labels.father, rel: pedigree.father },
    { key: "mother", title: labels.mother, rel: pedigree.mother },
    { key: "grandfather", title: labels.grandfather, rel: pedigree.grandfather },
    { key: "grandmother", title: labels.grandmother, rel: pedigree.grandmother },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {rows.map(({ key, title: ttl, rel }) => {
        if (!rel || (!String(rel.name ?? "").trim() && !String(rel.birthDate ?? "").trim() && !String(rel.color ?? "").trim())) {
          return null;
        }
        return (
          <div key={key} className="rounded-xl border border-border/60 bg-background px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{ttl}</p>
            {rel.name ? <p className="mt-1 text-sm font-medium text-foreground">{rel.name}</p> : null}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {rel.birthDate ? <span>{labels.birthDate}: {rel.birthDate}</span> : null}
              {rel.color ? <span>{labels.color}: {rel.color}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type ProfileFormState = {
  slug: string;
  category: HorseCategory;
  isActive: boolean;
  isForSale: boolean;
  isHeritage: boolean;
  birthDate: string;
  heightCm: string;
  owner: string;
  notes: string;
};

function profileFormFromItem(item: HorseDetails): ProfileFormState {
  return {
    slug: item.slug,
    category: item.category,
    isActive: item.isActive !== false,
    isForSale: item.isForSale === true,
    isHeritage: item.isHeritage === true,
    birthDate: item.birthDate ?? "",
    heightCm: typeof item.heightCm === "number" ? String(item.heightCm) : "",
    owner: item.owner ?? "",
    notes: item.notes ?? "",
  };
}

type TranslationLocaleFields = TranslationsForm[HorseLocale];

function buildLocaleTranslationPayload(tt: TranslationLocaleFields): Record<string, unknown> {
  return {
    name: tt.name.trim(), subtitle: tt.subtitle.trim(), description: tt.description.trim(),
    shortBio: tt.shortBio.trim(), tags: parseCommaTags(tt.tags), metaTitle: tt.metaTitle.trim(),
    metaDescription: tt.metaDescription.trim(),
    color: tt.color.trim(), breeder: tt.breeder.trim(),
    sireName: tt.sireName.trim(), damName: tt.damName.trim(), bloodline: tt.bloodline.trim(),
  };
}

/** Required fields for one locale when saving that locale's translation dialog. */
function hasLocaleRequired(fields: TranslationLocaleFields): boolean {
  return (
    fields.name.trim().length > 0 &&
    fields.shortBio.trim().length > 0 &&
    fields.description.trim().length > 0 &&
    parseCommaTags(fields.tags).length > 0
  );
}

const translationDialogRequiredKeys = new Set<keyof TranslationLocaleFields>([
  "name",
  "shortBio",
  "description",
  "tags",
]);

function TranslationFieldsEditor({
  dir,
  value,
  onField,
  t,
}: {
  dir: "ltr" | "rtl";
  value: TranslationLocaleFields;
  onField: (key: keyof TranslationLocaleFields, v: string) => void;
  t: (key: string) => string;
}) {
  const rows: Array<{ key: keyof TranslationLocaleFields; label: string; type: "input" | "textarea"; rows?: number }> = [
    { key: "name", label: t("fieldName"), type: "input" },
    { key: "subtitle", label: t("fieldSubtitle"), type: "input" },
    { key: "shortBio", label: t("fieldShortBio"), type: "textarea", rows: 2 },
    { key: "description", label: t("fieldDescription"), type: "textarea", rows: 4 },
    { key: "tags", label: t("fieldTags"), type: "input" },
    { key: "color", label: t("fieldColor"), type: "input" },
    { key: "breeder", label: t("fieldBreeder"), type: "input" },
    { key: "metaTitle", label: t("fieldMetaTitle"), type: "input" },
    { key: "metaDescription", label: t("fieldMetaDescription"), type: "textarea", rows: 2 },
    { key: "sireName", label: t("fieldSireName"), type: "input" },
    { key: "damName", label: t("fieldDamName"), type: "input" },
    { key: "bloodline", label: t("fieldBloodline"), type: "textarea", rows: 2 },
  ];
  return (
    <div className="grid gap-3">
      {rows.map(({ key, label, type, rows: taRows }) => (
        <div key={key} className="grid gap-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
            {translationDialogRequiredKeys.has(key) ? <RequiredStar /> : null}
          </Label>
          {type === "textarea" ? (
            <Textarea dir={dir} rows={taRows} value={value[key]} className="resize-none text-sm"
              onChange={(e) => onField(key, e.target.value)} />
          ) : (
            <Input dir={dir} value={value[key]} className="h-9" onChange={(e) => onField(key, e.target.value)} />
          )}
        </div>
      ))}
    </div>
  );
}

const updateSchema = z.object({
  slug: z.string().trim().min(1),
  category: z.enum(categories),
  isActive: z.boolean(),
});

const profileFormSchema = updateSchema.extend({
  birthDate: z.string(),
  heightCm: z.string().refine((s) => {
    const x = s.trim();
    if (!x) return true;
    const n = Number(x);
    return Number.isFinite(n) && n >= 0;
  }),
  owner: z.string(),
  notes: z.string(),
});

const awardSchema = z.object({
  year: z.string().trim().min(4).refine((v) => Number.isFinite(Number(v))),
  eventName: z.string().trim().min(1),
  title: z.string().trim().min(1),
  placing: z.string().trim().optional(),
  location: z.string().trim().optional(),
  externalLink: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^https?:\/\/\S+$/i.test(v), { message: "invalid-url" }),
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

const HORSE_GALLERY_MAX_FILES_PER_REQUEST = 10;
const HORSE_GALLERY_MAX_FILE_BYTES = 10 * 1024 * 1024;
const HORSE_GALLERY_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function isAllowedHorseGalleryFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) return true;
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
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
  const [mediaUploadFiles, setMediaUploadFiles] = useState<File[]>([]);
  const [mediaUploadCaption, setMediaUploadCaption] = useState("");
  const [mediaUploadSortOrder, setMediaUploadSortOrder] = useState("");
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [mediaUploadDropOver, setMediaUploadDropOver] = useState(false);
  const mediaUploadInputRef = useRef<HTMLInputElement>(null);

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
  const [awardForm, setAwardForm] = useState({ year: "", eventName: "", title: "", placing: "", location: "", externalLink: "", notes: "" });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);

  const [coverEditOpen, setCoverEditOpen] = useState(false);
  const [coverEditFile, setCoverEditFile] = useState<File | null>(null);

  const [pedigreeEditOpen, setPedigreeEditOpen] = useState(false);
  const [pedigreeEdit, setPedigreeEdit] = useState<HorsePedigree>({});

  const [translationEditOpen, setTranslationEditOpen] = useState(false);
  const [translationEnForm, setTranslationEnForm] = useState<TranslationLocaleFields | null>(null);
  const [translationArForm, setTranslationArForm] = useState<TranslationLocaleFields | null>(null);
  const [translationTab, setTranslationTab] = useState<HorseLocale>(
    locale === "ar" ? "ar" : "en"
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await fetchHorseById(id);
      setItem(next);
    } catch (e) {
      toastApiError(e, t("loadError"));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  const persistHorseUpdate = useCallback(
    async (patch: {
      base?: Partial<ProfileFormState>;
      /** Only from translation dialogs: one locale, dialog field values only. */
      translationPatch?: { locale: HorseLocale; fields: TranslationLocaleFields };
      pedigree?: HorsePedigree;
      coverFile?: File | null;
    }): Promise<boolean> => {
      const current = item;
      if (!current) return false;
      setSubmitting(true);
      try {
        let profileBase: ProfileFormState | null = null;
        if (patch.base !== undefined) {
          profileBase = {
            slug: patch.base.slug ?? current.slug,
            category: patch.base.category ?? current.category,
            isActive: patch.base.isActive ?? (current.isActive !== false),
            isForSale: patch.base.isForSale ?? (current.isForSale === true),
            isHeritage: patch.base.isHeritage ?? (current.isHeritage === true),
            birthDate: patch.base.birthDate ?? (current.birthDate ?? ""),
            heightCm: patch.base.heightCm ?? (typeof current.heightCm === "number" ? String(current.heightCm) : ""),
            owner: patch.base.owner ?? (current.owner ?? ""),
            notes: patch.base.notes ?? (current.notes ?? ""),
          };
          if (!profileFormSchema.safeParse(profileBase).success) {
            toast.error(t("invalidProfile"));
            return false;
          }
        }
        if (patch.translationPatch) {
          if (!hasLocaleRequired(patch.translationPatch.fields)) {
            toast.error(t("invalidTranslation"));
            return false;
          }
        }
        const fd = new FormData();
        if (profileBase) {
          fd.append("slug", profileBase.slug.trim());
          fd.append("category", profileBase.category);
          fd.append("isActive", profileBase.isActive ? "1" : "0");
          fd.append("isForSale", profileBase.isForSale ? "1" : "0");
          fd.append("isHeritage", profileBase.isHeritage ? "1" : "0");
          if (profileBase.birthDate.trim()) fd.append("birthDate", profileBase.birthDate.trim());
          if (profileBase.heightCm.trim()) fd.append("heightCm", profileBase.heightCm.trim());
          if (profileBase.owner.trim()) fd.append("owner", profileBase.owner.trim());
          if (profileBase.notes.trim()) fd.append("notes", profileBase.notes.trim());
        }
        if (patch.translationPatch) {
          const { locale, fields } = patch.translationPatch;
          fd.append(
            "translations",
            JSON.stringify({ [locale]: buildLocaleTranslationPayload(fields) })
          );
        }
        if (patch.pedigree !== undefined) {
          const pedStr = serializePedigreeForPatch(patch.pedigree, current.pedigree ?? null);
          if (pedStr !== undefined) fd.append("pedigree", pedStr);
        }
        if (patch.coverFile) fd.append("coverImage", patch.coverFile);
        await updateHorse(id, fd);
        toast.success(t("saveSuccess"));
        await load();
        return true;
      } catch (e) {
        toastApiError(e, t("saveError"));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [item, id, load, t]
  );

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

  function addFilesToGallerySelection(prev: File[], incoming: File[]): { next: File[]; error: string | null } {
    if (!incoming.length) return { next: prev, error: null };
    if (prev.length + incoming.length > HORSE_GALLERY_MAX_FILES_PER_REQUEST) {
      return { next: prev, error: tMedia("tooManyFiles") };
    }
    for (const f of incoming) {
      if (f.size > HORSE_GALLERY_MAX_FILE_BYTES) return { next: prev, error: tMedia("fileTooLarge") };
      if (!isAllowedHorseGalleryFile(f)) return { next: prev, error: tMedia("invalidFileType") };
    }
    return { next: [...prev, ...incoming], error: null };
  }

  function onMediaUploadDialogOpenChange(open: boolean) {
    setMediaUploadOpen(open);
    if (!open) {
      setMediaUploadFiles([]);
      setMediaUploadCaption("");
      setMediaUploadSortOrder("");
      setMediaUploadError(null);
      setMediaUploadDropOver(false);
    }
  }

  function onMediaUploadPick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (!list.length) return;
    setMediaUploadFiles((prev) => {
      const { next, error } = addFilesToGallerySelection(prev, list);
      setMediaUploadError(error);
      return error ? prev : next;
    });
  }

  function onMediaUploadDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setMediaUploadDropOver(false);
    const list = Array.from(e.dataTransfer.files ?? []);
    if (!list.length) return;
    setMediaUploadFiles((prev) => {
      const { next, error } = addFilesToGallerySelection(prev, list);
      setMediaUploadError(error);
      return error ? prev : next;
    });
  }

  async function onUploadMedia() {
    if (!mediaUploadFiles.length) { toast.error(tMedia("fileRequired")); return; }
    setSubmitting(true);
    try {
      const created = await addHorseMedia(id, {
        files: mediaUploadFiles,
        caption: mediaUploadCaption.trim() || undefined,
        sortOrder: mediaUploadSortOrder.trim() ? Number(mediaUploadSortOrder) : undefined,
      });
      toast.success(
        created.length === 1 ? tMedia("uploadSuccess") : tMedia("uploadSuccessMany", { count: created.length })
      );
      onMediaUploadDialogOpenChange(false);
      await loadMedia();
    } catch (e) { toastApiError(e, tMedia("uploadError")); }
    finally { setSubmitting(false); }
  }

  async function onReplaceMediaFile() {
    if (!mediaReplaceId || !mediaReplaceFile) { toast.error(tMedia("fileRequired")); return; }
    if (mediaReplaceFile.size > HORSE_GALLERY_MAX_FILE_BYTES) {
      toast.error(tMedia("fileTooLarge"));
      return;
    }
    if (!isAllowedHorseGalleryFile(mediaReplaceFile)) {
      toast.error(tMedia("invalidFileType"));
      return;
    }
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
    setAwardForm({ year: "", eventName: "", title: "", placing: "", location: "", externalLink: "", notes: "" });
    setAwardDialogOpen(true);
  }

  function openAwardEdit(a: HorseAward) {
    setAwardFormError(null); setAwardEditingId(a.id);
    setAwardForm({ year: String(a.year), eventName: a.eventName ?? "", title: a.title ?? "", placing: a.placing ?? "", location: a.location ?? "", externalLink: a.externalLink ?? "", notes: a.notes ?? "" });
    setAwardDialogOpen(true);
  }

  async function onSaveAward() {
    setAwardFormError(null);
    const parsed = awardSchema.safeParse(awardForm);
    if (!parsed.success) {
      const badUrl = parsed.error.issues.some((i) => i.path[0] === "externalLink");
      setAwardFormError(badUrl ? tAwards("invalidExternalLink") : tAwards("invalid"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        year: Number(awardForm.year), eventName: awardForm.eventName.trim(),
        title: awardForm.title.trim(), placing: awardForm.placing.trim() || null,
        location: awardForm.location.trim() || null, externalLink: awardForm.externalLink.trim() || null, notes: awardForm.notes.trim() || null,
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

  function setPedigreeRel(key: PedigreeRelKey, field: "name" | "birthDate" | "color", value: string) {
    setPedigreeEdit((p) => ({
      ...p,
      [key]: { ...(p[key] ?? {}), [field]: value || null },
    }));
  }

  const profileSaveDisabled = useMemo(() => {
    if (!profileForm) return true;
    return submitting || !profileFormSchema.safeParse(profileForm).success;
  }, [profileForm, submitting]);

  const translationEnSaveDisabled =
    submitting || !translationEnForm || !hasLocaleRequired(translationEnForm);
  const translationArSaveDisabled =
    submitting || !translationArForm || !hasLocaleRequired(translationArForm);
  const activeTranslationSaveDisabled =
    translationTab === "en" ? translationEnSaveDisabled : translationArSaveDisabled;

  async function onSaveProfile() {
    if (!profileForm) return;
    const ok = await persistHorseUpdate({ base: profileForm });
    if (ok) setProfileEditOpen(false);
  }

  async function onSaveCover() {
    if (!coverEditFile) {
      toast.error(t("coverRequired"));
      return;
    }
    const ok = await persistHorseUpdate({ coverFile: coverEditFile });
    if (ok) {
      setCoverEditOpen(false);
      setCoverEditFile(null);
    }
  }

  async function onSavePedigree() {
    const ok = await persistHorseUpdate({ pedigree: pedigreeEdit });
    if (ok) setPedigreeEditOpen(false);
  }

  async function onSaveTranslationEn() {
    if (!translationEnForm) return;
    const ok = await persistHorseUpdate({
      translationPatch: { locale: "en", fields: translationEnForm },
    });
    if (ok) setTranslationEditOpen(false);
  }

  async function onSaveTranslationAr() {
    if (!translationArForm) return;
    const ok = await persistHorseUpdate({
      translationPatch: { locale: "ar", fields: translationArForm },
    });
    if (ok) setTranslationEditOpen(false);
  }
  async function onSaveActiveTranslation() {
    if (translationTab === "en") {
      await onSaveTranslationEn();
    } else {
      await onSaveTranslationAr();
    }
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

  const displayColor = useMemo(() => {
    if (!item) return null;
    const want = locale === "ar" ? "ar" : "en";
    const tr = item.translations.find((x) => x.locale === want);
    const c = tr?.color?.trim();
    if (c) return c;
    return item.color?.trim() ?? null;
  }, [item, locale]);

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
        <>
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <Skeleton className="aspect-[21/9] max-h-56 w-full sm:aspect-auto sm:h-52" />
            <div className="h-3 border-b border-border/60 bg-muted/30" />
            <div className="p-4"><Skeleton className="h-8 w-32" /></div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
            <div className="h-3 border-b border-border/60 bg-muted/30" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              </div>
            </div>
          </div>
        </>
      ) : !item ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-20 text-center">
          <ChessKnight className="mx-auto size-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium">{t("notFound")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("notFoundHint")}</p>
        </div>
      ) : (
        <>
          <Section
            icon={ImageIcon}
            title={t("cardCover")}
            actions={
              <Button
                type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                disabled={submitting}
                onClick={() => { setCoverEditFile(null); setCoverEditOpen(true); }}
              >
                <Pencil className="size-3" /><span className="hidden sm:inline">{t("edit")}</span>
              </Button>
            }
          >
            <div className="relative aspect-[21/9] max-h-56 overflow-hidden rounded-xl border border-border/60 bg-muted sm:aspect-auto sm:h-52">
              {cover ? (
                <img src={cover} alt={title} className="h-full w-full object-cover" loading="lazy" decoding="async"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="size-10 text-muted-foreground/20" />
                </div>
              )}
            </div>
          </Section>

          <Section
            icon={ChessKnight}
            title={t("cardProfile")}
            badge={
              item.isActive !== false ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCircle2 className="size-3" />{tList("active")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <XCircle className="size-3" />{tList("inactive")}
                </span>
              )
            }
            actions={
              <Button
                type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                disabled={submitting}
                onClick={() => { if (item) setProfileForm(profileFormFromItem(item)); setProfileEditOpen(true); }}
              >
                <Pencil className="size-3" /><span className="hidden sm:inline">{t("edit")}</span>
              </Button>
            }
          >
            <div className="space-y-4">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h1>
                {subtitle ? <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="rounded-full font-normal">
                    {categoryLabel(tList, item.category)}
                  </Badge>
                  <StatBadge>{item.slug}</StatBadge>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden sm:grid-cols-4">
                {[
                  { icon: Calendar, label: t("fieldBirthDate"), value: item.birthDate },
                  { icon: Ruler, label: t("fieldHeightCm"), value: typeof item.heightCm === "number" ? `${item.heightCm} cm` : null },
                  { icon: Palette, label: t("fieldColor"), value: displayColor },
                  { icon: User, label: t("fieldOwner"), value: item.owner },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2.5 bg-background px-4 py-3">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">{label}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-foreground">{value ?? "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.isForSale ? (
                  <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-400">
                    {t("badgeForSale")}
                  </span>
                ) : null}
                {item.isHeritage ? (
                  <span className="inline-flex items-center rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-400">
                    {t("badgeHeritage")}
                  </span>
                ) : null}
              </div>
              {item.notes?.trim() ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("fieldNotes")}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.notes}</p>
                </div>
              ) : null}
            </div>
          </Section>

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
                        {a.externalLink ? (
                          <a
                            href={a.externalLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex text-xs text-primary underline-offset-2 hover:underline"
                          >
                            {tAwards("openExternalLink")}
                          </a>
                        ) : null}
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

          {/* ── Pedigree ───────────────────────────────────────────────────────── */}
          <Section
            icon={Network}
            title={t("pedigreeSection")}
            description={t("pedigreeSectionHint")}
            actions={
              <Button
                type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs"
                disabled={submitting}
                onClick={() => {
                  setPedigreeEdit(clonePedigree(item.pedigree));
                  setPedigreeEditOpen(true);
                }}
              >
                <Pencil className="size-3" /><span className="hidden sm:inline">{t("edit")}</span>
              </Button>
            }
          >
            {!pedigreeHasContent(item.pedigree) ? (
              <p className="text-sm text-muted-foreground">{t("pedigreeEmpty")}</p>
            ) : (
              <PedigreeReadonlyCards
                pedigree={item.pedigree}
                labels={{
                  father: t("pedigreeFather"),
                  mother: t("pedigreeMother"),
                  grandfather: t("pedigreeGrandfather"),
                  grandmother: t("pedigreeGrandmother"),
                  birthDate: t("pedigreeRelativeBirthDate"),
                  color: t("pedigreeRelativeColor"),
                }}
              />
            )}
          </Section>

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
                      item.translations.some((x) => x.locale === loc)
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {loc}
                  </span>
                ))}
              </div>
            }
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={submitting}
                onClick={() => {
                  const full = translationsFromItem(item);
                  setTranslationEnForm({ ...full.en });
                  setTranslationArForm({ ...full.ar });
                  setTranslationEditOpen(true);
                }}
              >
                <Pencil className="size-3" />
                <span className="hidden sm:inline">{t("edit")}</span>
              </Button>
            }
          >
            <Tabs
              value={translationTab}
              onValueChange={(v) => setTranslationTab((v as HorseLocale) === "ar" ? "ar" : "en")}
            >
              <TabsList className="w-full justify-between sm:w-auto sm:justify-start">
                <TabsTrigger value="en" className="flex-1 sm:flex-none">
                  {t("langEn")}
                </TabsTrigger>
                <TabsTrigger value="ar" className="flex-1 sm:flex-none">
                  {t("langAr")}
                </TabsTrigger>
              </TabsList>

              {(["en", "ar"] as const).map((loc) => {
                const tr = item.translations.find((x) => x.locale === loc) ?? null;
                const dir = loc === "ar" ? "rtl" : "ltr";
                return (
                  <TabsContent key={loc} value={loc}>
                    <div className="space-y-3" dir={dir}>
                      <InfoField label={t("fieldName")} value={tr?.name?.trim() ? tr.name : undefined} dir={dir} />
                      <InfoField label={t("fieldSubtitle")} value={tr?.subtitle?.trim() ? tr.subtitle : undefined} dir={dir} />
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{t("fieldShortBio")}</p>
                        <p className="whitespace-pre-wrap text-sm text-foreground" dir={dir}>{tr?.shortBio?.trim() ? tr.shortBio : "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{t("fieldDescription")}</p>
                        <p className="whitespace-pre-wrap text-sm text-foreground" dir={dir}>{tr?.description?.trim() ? tr.description : "—"}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{t("fieldTags")}</p>
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {(tr?.tags ?? []).length ? tr!.tags.map((tag, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{tag}</span>
                          )) : <span className="text-sm text-muted-foreground">—</span>}
                        </div>
                      </div>
                      <InfoField label={t("fieldColor")} value={tr?.color?.trim() ? tr.color : undefined} dir={dir} />
                      <InfoField label={t("fieldBreeder")} value={tr?.breeder?.trim() ? tr.breeder : undefined} dir={dir} />
                      <InfoField label={t("fieldMetaTitle")} value={tr?.metaTitle?.trim() ? tr.metaTitle : undefined} dir={dir} />
                      <InfoField label={t("fieldMetaDescription")} value={tr?.metaDescription?.trim() ? tr.metaDescription : undefined} dir={dir} />
                      <InfoField label={t("fieldSireName")} value={tr?.sireName?.trim() ? tr.sireName : undefined} dir={dir} />
                      <InfoField label={t("fieldDamName")} value={tr?.damName?.trim() ? tr.damName : undefined} dir={dir} />
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">{t("fieldBloodline")}</p>
                        <p className="whitespace-pre-wrap text-sm text-foreground" dir={dir}>{tr?.bloodline?.trim() ? tr.bloodline : "—"}</p>
                      </div>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </Section>
        </>
      )}

      {/* ══ DIALOGS ════════════════════════════════════════════════════════════ */}

      {/* Edit profile */}
      <Dialog
        open={profileEditOpen}
        onOpenChange={(open) => {
          setProfileEditOpen(open);
          if (!open) setProfileForm(null);
          else if (item) setProfileForm(profileFormFromItem(item));
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-hidden flex flex-col sm:w-auto sm:max-w-[560px]">
          <DialogHeader className="shrink-0 pb-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <Pencil className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogEditProfileTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogEditProfileDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {profileForm ? (
              <div className="grid gap-4 py-4 pr-1">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("fieldSlug")}
                      <RequiredStar />
                    </Label>
                    <Input
                      value={profileForm.slug}
                      onChange={(e) => setProfileForm((s) => (s ? { ...s, slug: e.target.value } : s))}
                      className="h-9"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("fieldCategory")}
                      <RequiredStar />
                    </Label>
                    <select
                      className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={profileForm.category}
                      onChange={(e) =>
                        setProfileForm((s) => (s ? { ...s, category: e.target.value as HorseCategory } : s))
                      }
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {categoryLabel(tList, c)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldBirthDate")}</Label>
                    <Input
                      type="date"
                      value={profileForm.birthDate}
                      className="h-9"
                      onChange={(e) => setProfileForm((s) => (s ? { ...s, birthDate: e.target.value } : s))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldHeightCm")}</Label>
                    <Input
                      inputMode="numeric"
                      value={profileForm.heightCm}
                      className="h-9"
                      onChange={(e) => setProfileForm((s) => (s ? { ...s, heightCm: e.target.value } : s))}
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldOwner")}</Label>
                    <Input
                      value={profileForm.owner}
                      className="h-9"
                      onChange={(e) => setProfileForm((s) => (s ? { ...s, owner: e.target.value } : s))}
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("fieldNotes")}</Label>
                    <Textarea
                      value={profileForm.notes}
                      rows={3}
                      className="resize-none text-sm"
                      onChange={(e) => setProfileForm((s) => (s ? { ...s, notes: e.target.value } : s))}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div>
                    <Label className="text-sm font-medium">{t("fieldIsActive")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {profileForm.isActive ? tList("active") : tList("inactive")}
                    </p>
                  </div>
                  <Switch
                    checked={profileForm.isActive}
                    onCheckedChange={(v) => setProfileForm((s) => (s ? { ...s, isActive: v } : s))}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                    <div>
                      <Label className="text-sm font-medium">{t("fieldIsForSale")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {profileForm.isForSale ? t("yes") : t("no")}
                      </p>
                    </div>
                    <Switch
                      checked={profileForm.isForSale}
                      onCheckedChange={(v) => setProfileForm((s) => (s ? { ...s, isForSale: v } : s))}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                    <div>
                      <Label className="text-sm font-medium">{t("fieldIsHeritage")}</Label>
                      <p className="text-xs text-muted-foreground">
                        {profileForm.isHeritage ? t("yes") : t("no")}
                      </p>
                    </div>
                    <Switch
                      checked={profileForm.isHeritage}
                      onCheckedChange={(v) => setProfileForm((s) => (s ? { ...s, isHeritage: v } : s))}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <Separator className="shrink-0" />
          <DialogFooter className="shrink-0 gap-2 pt-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setProfileEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={profileSaveDisabled}
              onClick={() => void onSaveProfile()}
              className="gap-1.5 min-w-24"
            >
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit cover */}
      <Dialog
        open={coverEditOpen}
        onOpenChange={(open) => {
          setCoverEditOpen(open);
          if (!open) setCoverEditFile(null);
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <ImageIcon className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogEditCoverTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogEditCoverDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("fieldCoverImage")}
              <RequiredStar />
            </Label>
            <label
              htmlFor="horse-cover-only"
              className="group flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/20 py-8 text-center transition-colors hover:border-border hover:bg-muted/30"
            >
              <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm transition-colors group-hover:bg-muted">
                {coverEditFile ? <ImageIcon className="size-5 text-foreground" /> : <Upload className="size-5 text-muted-foreground" />}
              </div>
              {coverEditFile ? (
                <div>
                  <p className="text-sm font-medium">{coverEditFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(coverEditFile.size / 1024).toFixed(1)} KB · {t("clickToReplace")}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium">{t("clickToUpload")}</p>
                  <p className="text-xs text-muted-foreground">{t("imageHint")}</p>
                </div>
              )}
              <Input
                id="horse-cover-only"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setCoverEditFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setCoverEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={submitting || !coverEditFile}
              onClick={() => void onSaveCover()}
              className="gap-1.5"
            >
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit pedigree */}
      <Dialog
        open={pedigreeEditOpen}
        onOpenChange={(open) => {
          setPedigreeEditOpen(open);
          if (open && item) setPedigreeEdit(clonePedigree(item.pedigree));
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-hidden flex flex-col sm:w-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <Network className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogEditPedigreeTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogEditPedigreeDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid gap-3 py-2 pr-1">
            {(["father", "mother", "grandfather", "grandmother"] as const).map((pkey) => {
              const relLabel =
                pkey === "father"
                  ? t("pedigreeFather")
                  : pkey === "mother"
                    ? t("pedigreeMother")
                    : pkey === "grandfather"
                      ? t("pedigreeGrandfather")
                      : t("pedigreeGrandmother");
              const rel = pedigreeEdit[pkey] ?? {};
              return (
                <div key={pkey} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground">{relLabel}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="grid gap-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">{t("pedigreeRelativeName")}</Label>
                      <Input
                        className="h-8 text-sm"
                        value={rel.name ?? ""}
                        onChange={(e) => setPedigreeRel(pkey, "name", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">{t("pedigreeRelativeBirthDate")}</Label>
                      <Input
                        type="date"
                        className="h-8 text-sm"
                        value={pedigreeBirthDateForDateInput(rel.birthDate)}
                        onChange={(e) => setPedigreeRel(pkey, "birthDate", e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">{t("pedigreeRelativeColor")}</Label>
                      <Input
                        className="h-8 text-sm"
                        value={rel.color ?? ""}
                        onChange={(e) => setPedigreeRel(pkey, "color", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          <Separator />
          <DialogFooter className="shrink-0 gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setPedigreeEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void onSavePedigree()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Network className="size-3.5" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit translation */}
      <Dialog
        open={translationEditOpen}
        onOpenChange={(open) => {
          setTranslationEditOpen(open);
          if (!open) {
            setTranslationEnForm(null);
            setTranslationArForm(null);
          } else if (item) {
            const all = translationsFromItem(item);
            setTranslationEnForm({ ...all.en });
            setTranslationArForm({ ...all.ar });
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-hidden flex flex-col sm:w-auto sm:max-w-[640px]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <Globe className="size-3.5 text-muted-foreground" />
              </div>
              {t("dialogEditTranslationTitle", { locale: translationTab === "en" ? t("langEn") : t("langAr") })}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("dialogEditTranslationDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <Tabs
            value={translationTab}
            onValueChange={(v) => setTranslationTab(v === "ar" ? "ar" : "en")}
            className="min-h-0 flex flex-1 flex-col"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="en">{t("langEn")}</TabsTrigger>
              <TabsTrigger value="ar">{t("langAr")}</TabsTrigger>
            </TabsList>
            <div className="min-h-0 flex-1 overflow-y-auto py-2 pr-1">
              <TabsContent value="en">
                {translationEnForm ? (
                  <TranslationFieldsEditor
                    dir="ltr"
                    value={translationEnForm}
                    onField={(key, v) => setTranslationEnForm((s) => (s ? { ...s, [key]: v } : s))}
                    t={t}
                  />
                ) : null}
              </TabsContent>
              <TabsContent value="ar">
                {translationArForm ? (
                  <TranslationFieldsEditor
                    dir="rtl"
                    value={translationArForm}
                    onField={(key, v) => setTranslationArForm((s) => (s ? { ...s, [key]: v } : s))}
                    t={t}
                  />
                ) : null}
              </TabsContent>
            </div>
          </Tabs>
          <Separator />
          <DialogFooter className="shrink-0 gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setTranslationEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={activeTranslationSaveDisabled}
              onClick={() => void onSaveActiveTranslation()}
              className="gap-1.5"
            >
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
      <Dialog open={mediaUploadOpen} onOpenChange={onMediaUploadDialogOpenChange}>
        <DialogContent className="sm:max-w-[520px]">
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
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tMedia("files")}
                <RequiredStar />
              </Label>
              <input
                ref={mediaUploadInputRef}
                type="file"
                accept={HORSE_GALLERY_ACCEPT}
                multiple
                className="sr-only"
                onChange={onMediaUploadPick}
              />
              <button
                type="button"
                onDragEnter={(ev) => { ev.preventDefault(); ev.stopPropagation(); setMediaUploadDropOver(true); }}
                onDragLeave={(ev) => { ev.preventDefault(); ev.stopPropagation(); setMediaUploadDropOver(false); }}
                onDragOver={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                onDrop={onMediaUploadDrop}
                onClick={() => mediaUploadInputRef.current?.click()}
                className={cn(
                  "flex min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-xs transition-colors",
                  mediaUploadDropOver
                    ? "border-primary/60 bg-primary/5"
                    : "border-border/80 bg-muted/20 hover:border-border"
                )}
              >
                <span className="pointer-events-none flex flex-col items-center gap-2">
                  <Upload className="size-6 text-muted-foreground" />
                  <span className="font-medium text-foreground">{tMedia("dropHint")}</span>
                  <span className="max-w-[300px] text-muted-foreground">{tMedia("maxFilesHint")}</span>
                </span>
              </button>
              {mediaUploadError ? (
                <p className="text-xs text-destructive">{mediaUploadError}</p>
              ) : null}
              {mediaUploadFiles.length > 0 ? (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border/60 bg-muted/10 p-2">
                  {mediaUploadFiles.map((f, idx) => (
                    <li key={`${f.name}-${f.size}-${idx}`} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{f.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setMediaUploadFiles((prev) => prev.filter((_, i) => i !== idx));
                          setMediaUploadError(null);
                        }}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tMedia("caption")}</Label>
              <Input value={mediaUploadCaption} className="h-9" onChange={(e) => setMediaUploadCaption(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tMedia("sortOrder")}</Label>
              <Input inputMode="numeric" value={mediaUploadSortOrder} placeholder="0" className="h-9" onChange={(e) => setMediaUploadSortOrder(e.target.value)} />
              <p className="text-[11px] leading-snug text-muted-foreground">{tMedia("sortOrderHint")}</p>
            </div>
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onMediaUploadDialogOpenChange(false)}>{tMedia("cancel")}</Button>
            <Button
              type="button"
              disabled={submitting || mediaUploadFiles.length === 0}
              onClick={() => void onUploadMedia()}
              className="gap-1.5"
            >
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
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tMedia("file")}
                <RequiredStar />
              </Label>
              <Input
                type="file"
                accept={HORSE_GALLERY_ACCEPT}
                className="h-9"
                onChange={(e) => setMediaReplaceFile(e.target.files?.[0] ?? null)}
              />
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
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tAwards("fieldYear")}
                  <RequiredStar />
                </Label>
                <Input inputMode="numeric" value={awardForm.year} placeholder="2026" className="h-9"
                  onChange={(e) => setAwardForm((s) => ({ ...s, year: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tAwards("fieldEventName")}
                  <RequiredStar />
                </Label>
                <Input value={awardForm.eventName} className="h-9"
                  onChange={(e) => setAwardForm((s) => ({ ...s, eventName: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tAwards("fieldTitle")}
                <RequiredStar />
              </Label>
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
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{tAwards("fieldExternalLink")}</Label>
              <Input
                type="url"
                value={awardForm.externalLink}
                placeholder={tAwards("fieldExternalLinkPlaceholder")}
                className="h-9"
                onChange={(e) => setAwardForm((s) => ({ ...s, externalLink: e.target.value }))}
              />
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