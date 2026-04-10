"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import Cropper, { type Area } from "react-easy-crop";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe,
  Image as ImageIcon,
  Layers,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
  Info,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toastApiError } from "@/lib/toast-api-error";
import {
  deletePageCover,
  fetchPageByKey,
  fetchPages,
  type PageKey,
  type PageLocale,
  type PageTitleColor,
  type PageTranslation,
  type StaffPage,
  upsertPage,
} from "@/lib/pages-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_KEYS: readonly PageKey[] = [
  "home",
  "farm",
  "news",
  "events",
  "horses",
  "contact",
];

const KEY_TO_PATH: Record<PageKey, string> = {
  home: "/",
  farm: "/farm",
  news: "/news",
  events: "/events",
  horses: "/horses",
  contact: "/contact",
};

const KEY_TO_ICON: Record<PageKey, React.ElementType> = {
  home: Layers,
  farm: Globe,
  news: FileText,
  events: FileText,
  horses: Globe,
  contact: FileText,
};

const COVER_MAX_BYTES = 10 * 1024 * 1024;
const COVER_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
type CropPreset = {
  desktop: { aspect: number; targetW: number; targetH: number };
  mobile: { aspect: number; targetW: number; targetH: number };
};

const HOME_CROP_PRESET: CropPreset = {
  desktop: { aspect: 16 / 9, targetW: 1920, targetH: 1080 },
  mobile: { aspect: 9 / 16, targetW: 1080, targetH: 1920 },
};

const INNER_PAGE_CROP_PRESET: CropPreset = {
  // Other pages use shorter strip-like hero sections.
  desktop: { aspect: 3 / 1, targetW: 2100, targetH: 700 },
  mobile: { aspect: 4 / 5, targetW: 1080, targetH: 1350 },
};

function cropPresetForKey(key: PageKey | null): CropPreset {
  if (key === "home") return HOME_CROP_PRESET;
  return INNER_PAGE_CROP_PRESET;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAllowedCover(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name.toLowerCase());
}

function isMissingPage(page: StaffPage): boolean {
  const en = page.translations.find((t) => t.locale === "en");
  const ar = page.translations.find((t) => t.locale === "ar");
  const enOk = (en?.title ?? "").trim().length > 0;
  const arOk = (ar?.title ?? "").trim().length > 0;
  return !enOk || !arOk;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TranslationForm = {
  title: string;
  titleColor: PageTitleColor;
  subtitle: string;
  text: string;
  metaDescription: string;
  metaKeywords: string;
};

type PageEditForm = {
  isActive: boolean;
  coverCrop: string;
  en: TranslationForm;
  ar: TranslationForm;
};

type PageLocaleTab = "en" | "ar";

function emptyTr(): TranslationForm {
  return { title: "", titleColor: "white", subtitle: "", text: "", metaDescription: "", metaKeywords: "" };
}

function trFromRow(row: PageTranslation | null | undefined): TranslationForm {
  return {
    title: row?.title ?? "",
    titleColor: row?.titleColor === "black" ? "black" : "white",
    subtitle: row?.subtitle ?? "",
    text: row?.text ?? "",
    metaDescription: row?.metaDescription ?? "",
    metaKeywords: row?.metaKeywords ?? "",
  };
}

function bestTr(page: StaffPage, locale: string): PageTranslation | null {
  const want: PageLocale = locale === "ar" ? "ar" : "en";
  return (
    page.translations.find((t) => t.locale === want) ??
    page.translations.find((t) => t.locale === "en") ??
    page.translations[0] ??
    null
  );
}

function formFromPage(page: StaffPage | null): PageEditForm {
  const en = page?.translations.find((t) => t.locale === "en") ?? null;
  const ar = page?.translations.find((t) => t.locale === "ar") ?? null;
  const crop =
    page?.coverCrop == null
      ? ""
      : typeof page.coverCrop === "string"
        ? page.coverCrop
        : JSON.stringify(page.coverCrop, null, 2);
  return {
    isActive: page?.isActive !== false,
    coverCrop: crop,
    en: trFromRow(en),
    ar: trFromRow(ar),
  };
}

function buildTranslationsJson(form: PageEditForm): string {
  return JSON.stringify({
    en: {
      title: form.en.title.trim(),
      titleColor: form.en.titleColor,
      subtitle: form.en.subtitle.trim(),
      text: form.en.text.trim(),
      metaDescription: form.en.metaDescription.trim(),
      metaKeywords: form.en.metaKeywords.trim(),
    },
    ar: {
      title: form.ar.title.trim(),
      titleColor: form.ar.titleColor,
      subtitle: form.ar.subtitle.trim(),
      text: form.ar.text.trim(),
      metaDescription: form.ar.metaDescription.trim(),
      metaKeywords: form.ar.metaKeywords.trim(),
    },
  });
}

function hasRequiredTr(form: TranslationForm): boolean {
  return form.title.trim().length > 0;
}

// ─── Locale Tab Input ─────────────────────────────────────────────────────────

function LocaleTabField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ─── Page Card ────────────────────────────────────────────────────────────────

function PageCard({
  page,
  locale,
  submitting,
  t,
  onEdit,
}: {
  page: StaffPage;
  locale: string;
  submitting: boolean;
  t: ReturnType<typeof useTranslations<"PagesAdmin">>;
  onEdit: (key: PageKey) => void;
}) {
  const tr = bestTr(page, locale);
  const isActive = page.isActive !== false;
  const missing = isMissingPage(page);
  const Icon = KEY_TO_ICON[page.key] ?? FileText;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-200",
        missing
          ? "border-amber-300/70 bg-amber-50/30 dark:border-amber-700/50 dark:bg-amber-950/20 shadow-amber-100/50 dark:shadow-amber-900/20 shadow-sm"
          : "border-border/60 hover:border-border hover:shadow-md shadow-sm"
      )}
    >
      {/* Cover / placeholder */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted/30">
        {page.coverImage ? (
          <img
            src={page.coverImage}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="size-10 text-muted-foreground/20" />
          </div>
        )}

        {/* Status pill — top-right */}
        <div className="absolute right-2.5 top-2.5">
          {isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-emerald-50/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 backdrop-blur-sm dark:border-emerald-700/50 dark:bg-emerald-950/80 dark:text-emerald-400">
              <CheckCircle2 className="size-2.5" />
              {t("active")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground backdrop-blur-sm">
              <XCircle className="size-2.5" />
              {t("inactive")}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* "Needs setup" banner */}
        {missing && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-950/40">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-[11px] font-medium leading-snug text-amber-700 dark:text-amber-300">
              {t("pageNotConfigured")}
            </p>
          </div>
        )}

        {/* Path + title */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {KEY_TO_PATH[page.key]}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-foreground">
            {tr?.title?.trim() ? tr.title : (
              <span className="italic text-muted-foreground/60">{t("noTitle")}</span>
            )}
          </p>
          {tr?.subtitle?.trim() ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{tr.subtitle}</p>
          ) : (
            <p className="mt-0.5 text-xs italic text-muted-foreground/40">{t("noSubtitle")}</p>
          )}
        </div>

        {/* Footer: locale fill indicators + edit button */}
        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5">
            {(["en", "ar"] as const).map((loc) => {
              const locTr = page.translations.find((t) => t.locale === loc);
              const filled = !!locTr?.title?.trim();
              return (
                <span
                  key={loc}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    filled
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/60 text-muted-foreground/50"
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", filled ? "bg-primary" : "bg-muted-foreground/30")} />
                  {loc}
                </span>
              );
            })}
          </div>
          <Button
            type="button"
            size="sm"
            variant={missing ? "default" : "outline"}
            className={cn(
              "h-7 gap-1.5 rounded-lg px-2.5 text-xs font-medium",
              missing && "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
            )}
            disabled={submitting}
            onClick={() => onEdit(page.key)}
          >
            <Pencil className="size-3" />
            {missing ? t("setupPage") : t("edit")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Translation Column ───────────────────────────────────────────────────────

function TranslationColumn({
  locale,
  value,
  onChange,
  t,
}: {
  locale: "en" | "ar";
  value: TranslationForm;
  onChange: (next: TranslationForm) => void;
  t: ReturnType<typeof useTranslations<"PagesAdmin">>;
}) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const isComplete = hasRequiredTr(value);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-4 transition-colors",
        isComplete ? "border-border/60 bg-background" : "border-amber-300/60 bg-amber-50/30 dark:border-amber-700/40 dark:bg-amber-950/20"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex size-6 items-center justify-center rounded-md text-[10px] font-bold uppercase",
            locale === "en" ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
          )}>
            {locale}
          </div>
          <span className="text-sm font-semibold">
            {locale === "en" ? t("langEn") : t("langAr")}
          </span>
        </div>
        {!isComplete && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3" />
            {t("incomplete")}
          </span>
        )}
      </div>

      <Separator />

      <div className="grid gap-3" dir={dir}>
        <LocaleTabField label={t("titleField")} required>
          <Input
            value={value.title}
            dir={dir}
            lang={locale}
            className="h-9 text-sm"
            placeholder={locale === "ar" ? "عنوان الصفحة" : "Page title"}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </LocaleTabField>

        <LocaleTabField label={t("titleColor")}>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={value.titleColor === "white" ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => onChange({ ...value, titleColor: "white" })}
            >
              {t("titleColorWhite")}
            </Button>
            <Button
              type="button"
              variant={value.titleColor === "black" ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => onChange({ ...value, titleColor: "black" })}
            >
              {t("titleColorBlack")}
            </Button>
          </div>
        </LocaleTabField>

        <LocaleTabField label={t("subtitleField")}>
          <Input
            value={value.subtitle}
            dir={dir}
            lang={locale}
            className="h-9 text-sm"
            placeholder={locale === "ar" ? "عنوان فرعي اختياري" : "Optional subtitle"}
            onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
          />
        </LocaleTabField>

        <LocaleTabField label={t("textField")}>
          <Textarea
            value={value.text}
            dir={dir}
            lang={locale}
            rows={5}
            className="resize-none text-sm leading-relaxed"
            placeholder={locale === "ar" ? "المحتوى الرئيسي للصفحة…" : "Main page content…"}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
          />
        </LocaleTabField>

        <Separator className="my-0.5 opacity-60" />

        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Info className="size-3" />
          {t("seoSection")}
        </p>

        <LocaleTabField label={t("metaDescriptionField")}>
          <Textarea
            value={value.metaDescription}
            dir={dir}
            lang={locale}
            rows={2}
            className="resize-none text-sm"
            placeholder={locale === "ar" ? "وصف قصير للمحركات البحثية" : "Short description for search engines"}
            onChange={(e) => onChange({ ...value, metaDescription: e.target.value })}
          />
        </LocaleTabField>

        <LocaleTabField label={t("metaKeywordsField")}>
          <Input
            value={value.metaKeywords}
            dir={dir}
            lang={locale}
            className="h-9 text-sm"
            placeholder={locale === "ar" ? "كلمة١، كلمة٢" : "keyword1, keyword2"}
            onChange={(e) => onChange({ ...value, metaKeywords: e.target.value })}
          />
        </LocaleTabField>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function PagesPanel() {
  const t = useTranslations("PagesAdmin");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StaffPage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [removingCover, setRemovingCover] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState<PageKey | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState<PageEditForm>(() => formFromPage(null));
  const [editLocaleTab, setEditLocaleTab] = useState<PageLocaleTab>(locale === "ar" ? "ar" : "en");

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverCropDesktopXY, setCoverCropDesktopXY] = useState({ x: 0, y: 0 });
  const [coverCropMobileXY, setCoverCropMobileXY] = useState({ x: 0, y: 0 });
  const [coverDesktopZoom, setCoverDesktopZoom] = useState(1);
  const [coverMobileZoom, setCoverMobileZoom] = useState(1);
  const [coverDesktopAreaPercent, setCoverDesktopAreaPercent] = useState<Area | null>(null);
  const [coverMobileAreaPercent, setCoverMobileAreaPercent] = useState<Area | null>(null);
  const [cropPreset, setCropPreset] = useState<CropPreset>(HOME_CROP_PRESET);
  /** Current server cover URLs for this key (shown until user picks a replacement file). */
  const [editCoverImageDesktopUrl, setEditCoverImageDesktopUrl] = useState<string | null>(null);
  const [editCoverImageMobileUrl, setEditCoverImageMobileUrl] = useState<string | null>(null);

  // ── Counts ──
  const missingCount = useMemo(
    () => rows.filter((p) => isMissingPage(p)).length,
    [rows]
  );

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchPages();
      const byKey = new Map(list.map((p) => [p.key, p] as const));
      const merged = PAGE_KEYS.map(
        (k) => byKey.get(k) ?? ({ key: k, isActive: false, translations: [] } as StaffPage)
      );
      setRows(merged);
    } catch (e) {
      toastApiError(e, t("loadError"));
      setRows(PAGE_KEYS.map((k) => ({ key: k, isActive: false, translations: [] } as StaffPage)));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Validation ──
  const editDisabled = useMemo(() => {
    if (submitting || editLoading) return true;
    if (!hasRequiredTr(editForm.en) || !hasRequiredTr(editForm.ar)) return true;
    if (editCoverFile) {
      if (editCoverFile.size > COVER_MAX_BYTES) return true;
      if (!isAllowedCover(editCoverFile)) return true;
      if (!coverDesktopAreaPercent || !coverMobileAreaPercent) return true;
    }
    return false;
  }, [coverDesktopAreaPercent, coverMobileAreaPercent, editCoverFile, editForm, editLoading, submitting]);

  // ── Open edit ──
  async function openEdit(key: PageKey) {
    setCropPreset(cropPresetForKey(key));
    const existing = rows.find((r) => r.key === key);
    setEditKey(key);
    setEditCoverFile(null);
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCoverCropDesktopXY({ x: 0, y: 0 });
    setCoverCropMobileXY({ x: 0, y: 0 });
    setCoverDesktopZoom(1);
    setCoverMobileZoom(1);
    setCoverDesktopAreaPercent(null);
    setCoverMobileAreaPercent(null);
    setEditForm(formFromPage(existing ?? null));
    setEditLocaleTab(locale === "ar" ? "ar" : "en");
    setEditCoverImageDesktopUrl(existing?.coverImageDesktop ?? existing?.coverImage ?? null);
    setEditCoverImageMobileUrl(existing?.coverImageMobile ?? null);
    setEditLoading(true);
    setEditOpen(true);
    try {
      const item = await fetchPageByKey(key);
      setEditForm(formFromPage(item));
      setEditCoverImageDesktopUrl(item.coverImageDesktop ?? item.coverImage ?? null);
      setEditCoverImageMobileUrl(item.coverImageMobile ?? null);
    } catch {
      if (!existing) {
        setEditForm(formFromPage(null));
        setEditCoverImageDesktopUrl(null);
        setEditCoverImageMobileUrl(null);
      }
    } finally {
      setEditLoading(false);
    }
  }

  // ── Save ──
  async function onSave() {
    const key = editKey;
    if (!key) return;
    if (!hasRequiredTr(editForm.en) || !hasRequiredTr(editForm.ar)) {
      if (!hasRequiredTr(editForm.en)) setEditLocaleTab("en");
      else if (!hasRequiredTr(editForm.ar)) setEditLocaleTab("ar");
      toast.error(t("invalidTranslations"));
      return;
    }
    let cropDesktopJson: string | undefined;
    let cropMobileJson: string | undefined;
    if (editCoverFile && coverDesktopAreaPercent && coverMobileAreaPercent) {
      const desktop = coverDesktopAreaPercent;
      const mobile = coverMobileAreaPercent;
      cropDesktopJson = JSON.stringify({
        presets: [{
          key: "coverDesktop",
          targetW: cropPreset.desktop.targetW,
          targetH: cropPreset.desktop.targetH,
          x: +desktop.x.toFixed(4),
          y: +desktop.y.toFixed(4),
          w: +desktop.width.toFixed(4),
          h: +desktop.height.toFixed(4),
          unit: "percent",
        }],
      });
      cropMobileJson = JSON.stringify({
        presets: [{
          key: "coverMobile",
          targetW: cropPreset.mobile.targetW,
          targetH: cropPreset.mobile.targetH,
          x: +mobile.x.toFixed(4),
          y: +mobile.y.toFixed(4),
          w: +mobile.width.toFixed(4),
          h: +mobile.height.toFixed(4),
          unit: "percent",
        }],
      });
    }
    if (editCoverFile) {
      if (editCoverFile.size > COVER_MAX_BYTES) { toast.error(t("coverTooLarge")); return; }
      if (!isAllowedCover(editCoverFile)) { toast.error(t("coverInvalidType")); return; }
    }
    setSubmitting(true);
    try {
      const saved = await upsertPage({
        key,
        isActive: editForm.isActive,
        coverCropJson: cropDesktopJson,
        coverCropDesktopJson: cropDesktopJson,
        coverCropMobileJson: cropMobileJson,
        translationsJson: buildTranslationsJson(editForm),
        coverFile: editCoverFile ?? undefined,
      });
      setRows((prev) => prev.map((p) => (p.key === key ? saved : p)));
      toast.success(t("saveSuccess"));
      closeDialog();
      await load();
    } catch (e) {
      toastApiError(e, t("saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onRemoveCover() {
    const key = editKey;
    if (!key || (!editCoverImageDesktopUrl && !editCoverImageMobileUrl) || editCoverFile) return;
    setRemovingCover(true);
    try {
      const page = await deletePageCover(key);
      setRows((prev) => prev.map((p) => (p.key === key ? page : p)));
      setEditCoverImageDesktopUrl(page.coverImageDesktop ?? page.coverImage ?? null);
      setEditCoverImageMobileUrl(page.coverImageMobile ?? null);
      setEditForm((s) => ({
        ...s,
        coverCrop:
          page.coverCrop == null
            ? ""
            : typeof page.coverCrop === "string"
              ? page.coverCrop
              : JSON.stringify(page.coverCrop, null, 2),
      }));
      toast.success(t("coverRemoveSuccess"));
    } catch (e) {
      toastApiError(e, t("coverRemoveError"));
    } finally {
      setRemovingCover(false);
    }
  }

  // ── Close dialog ──
  function closeDialog() {
    setEditOpen(false);
    setEditKey(null);
    setRemovingCover(false);
    setEditCoverFile(null);
    setEditCoverImageDesktopUrl(null);
    setEditCoverImageMobileUrl(null);
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCoverCropDesktopXY({ x: 0, y: 0 });
    setCoverCropMobileXY({ x: 0, y: 0 });
    setCoverDesktopZoom(1);
    setCoverMobileZoom(1);
    setCoverDesktopAreaPercent(null);
    setCoverMobileAreaPercent(null);
    setCropPreset(HOME_CROP_PRESET);
    setEditForm(formFromPage(null));
  }

  const isNewPage = !loading && editKey
    ? isMissingPage(rows.find((r) => r.key === editKey) ?? { key: editKey, isActive: false, translations: [] })
    : false;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:px-6 sm:py-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <FileText className="size-4.5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
              {t("title")}
              {missingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/60 dark:text-amber-400">
                  <AlertTriangle className="size-2.5" />
                  {missingCount} {t("needsSetup")}
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-muted-foreground"
          disabled={loading || submitting}
          onClick={() => void load()}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {/* ── Attention banner when any pages are unconfigured ── */}
      {!loading && missingCount > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50/60 px-4 py-3.5 dark:border-amber-700/50 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="grid gap-0.5">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t("bannerTitle", { count: missingCount })}
            </p>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              {t("bannerDescription")}
            </p>
          </div>
        </div>
      )}

      {/* ── Grid ── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAGE_KEYS.map((k) => (
            <Skeleton key={k} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((page) => (
            <PageCard
              key={page.key}
              page={page}
              locale={locale}
              submitting={submitting}
              t={t}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden sm:max-w-[960px]">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
              <div className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-muted shadow-sm">
                <Globe className="size-3.5 text-muted-foreground" />
              </div>
              <span>
                {t("editTitle", { key: editKey ? t(`key.${editKey}` as never) : "" })}
              </span>
              {editKey && (
                <span className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {KEY_TO_PATH[editKey]}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("editDescription")}</DialogDescription>
          </DialogHeader>

          {/* "New page" notice inside dialog */}
          {isNewPage && !editLoading && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/70 bg-amber-50/60 px-4 py-3 dark:border-amber-700/50 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                {t("dialogNewPageNotice")}
              </p>
            </div>
          )}

          <Separator />

          {/* ── Scrollable body ── */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {editLoading ? (
              <div className="grid gap-3 p-4">
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-72 rounded-xl" />
              </div>
            ) : (
              <div className="grid gap-5 p-4">

                {/* Active toggle */}
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                  <div>
                    <Label className="text-sm font-semibold">{t("isActive")}</Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {editForm.isActive ? t("activeHint") : t("inactiveHint")}
                    </p>
                  </div>
                  <Switch
                    checked={editForm.isActive}
                    onCheckedChange={(v) => setEditForm((s) => ({ ...s, isActive: v }))}
                  />
                </div>

                {/* Cover image upload (optional — new file replaces server cover when saved) */}
                <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("coverImage")}
                  </Label>
                  {(editCoverImageDesktopUrl || editCoverImageMobileUrl) && !editCoverFile ? (
                    <div className="grid gap-2">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid gap-1.5">
                          <span className="text-[11px] text-muted-foreground font-medium">Desktop banner</span>
                          <div
                            className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-muted"
                            style={{ aspectRatio: `${cropPreset.desktop.targetW} / ${cropPreset.desktop.targetH}` }}
                          >
                            {editCoverImageDesktopUrl ? (
                              <img src={editCoverImageDesktopUrl} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                        </div>
                        <div className="grid gap-1.5">
                          <span className="text-[11px] text-muted-foreground font-medium">Mobile banner</span>
                          <div
                            className="relative max-h-[280px] w-full overflow-hidden rounded-xl border border-border/60 bg-muted"
                            style={{ aspectRatio: `${cropPreset.mobile.targetW} / ${cropPreset.mobile.targetH}` }}
                          >
                            {editCoverImageMobileUrl ? (
                              <img src={editCoverImageMobileUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Fallback to desktop</div>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 self-start border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={submitting || removingCover || editLoading}
                        onClick={() => void onRemoveCover()}
                      >
                        {removingCover ? (
                          <RefreshCw className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        {t("removeCover")}
                      </Button>
                    </div>
                  ) : null}
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept={COVER_ACCEPT}
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setEditCoverFile(file);
                      setCoverPreviewUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return file ? URL.createObjectURL(file) : null;
                      });
                      if (file) {
                        setCoverCropDesktopXY({ x: 0, y: 0 });
                        setCoverCropMobileXY({ x: 0, y: 0 });
                        setCoverDesktopZoom(1);
                        setCoverMobileZoom(1);
                        setCoverDesktopAreaPercent(null);
                        setCoverMobileAreaPercent(null);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="group/up flex min-h-[100px] w-full flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border/70 bg-background px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    <Upload className="size-5 text-muted-foreground transition-colors group-hover/up:text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {editCoverFile ? editCoverFile.name : t("pickCover")}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("coverHint")}</span>
                  </button>
                </div>

                {/* Crops */}
                {coverPreviewUrl && (
                  <div className="grid gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div className="grid gap-1">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("coverCrop")} (Desktop + Mobile)
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        Crop desktop at 16:9 and mobile at 9:16 for each upload.
                      </span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Desktop ({cropPreset.desktop.targetW}:{cropPreset.desktop.targetH})
                        </Label>
                        <div
                          className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-muted"
                          style={{ aspectRatio: `${cropPreset.desktop.targetW} / ${cropPreset.desktop.targetH}` }}
                        >
                          <Cropper
                            image={coverPreviewUrl}
                            crop={coverCropDesktopXY}
                            zoom={coverDesktopZoom}
                            aspect={cropPreset.desktop.aspect}
                            onCropChange={setCoverCropDesktopXY}
                            onZoomChange={setCoverDesktopZoom}
                            onCropComplete={(areaPercent) => setCoverDesktopAreaPercent(areaPercent)}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("zoom")} — {coverDesktopZoom.toFixed(2)}×
                          </Label>
                          <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={coverDesktopZoom}
                            className="accent-primary"
                            onChange={(e) => setCoverDesktopZoom(Number(e.target.value))}
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Mobile ({cropPreset.mobile.targetW}:{cropPreset.mobile.targetH})
                        </Label>
                        <div
                          className="relative max-h-[360px] w-full overflow-hidden rounded-xl border border-border/60 bg-muted"
                          style={{ aspectRatio: `${cropPreset.mobile.targetW} / ${cropPreset.mobile.targetH}` }}
                        >
                          <Cropper
                            image={coverPreviewUrl}
                            crop={coverCropMobileXY}
                            zoom={coverMobileZoom}
                            aspect={cropPreset.mobile.aspect}
                            onCropChange={setCoverCropMobileXY}
                            onZoomChange={setCoverMobileZoom}
                            onCropComplete={(areaPercent) => setCoverMobileAreaPercent(areaPercent)}
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("zoom")} — {coverMobileZoom.toFixed(2)}×
                          </Label>
                          <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={coverMobileZoom}
                            className="accent-primary"
                            onChange={(e) => setCoverMobileZoom(Number(e.target.value))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Translations — side by side */}
                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("translations")}
                    </Label>
                    <span className="text-[10px] text-muted-foreground/60">
                      {t("translationsHint")}
                    </span>
                  </div>
                  <Tabs value={editLocaleTab} onValueChange={(v) => setEditLocaleTab(v === "ar" ? "ar" : "en")}>
                    <TabsList>
                      <TabsTrigger value="en">{t("langEn")}</TabsTrigger>
                      <TabsTrigger value="ar">{t("langAr")}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="en">
                      <TranslationColumn
                        locale="en"
                        value={editForm.en}
                        onChange={(next) => setEditForm((s) => ({ ...s, en: next }))}
                        t={t}
                      />
                    </TabsContent>
                    <TabsContent value="ar">
                      <TranslationColumn
                        locale="ar"
                        value={editForm.ar}
                        onChange={(next) => setEditForm((s) => ({ ...s, ar: next }))}
                        t={t}
                      />
                    </TabsContent>
                  </Tabs>
                </div>

              </div>
            )}
          </div>

          <Separator />

          <DialogFooter className="shrink-0 gap-2 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={closeDialog}
              className="h-8 px-4 text-xs"
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={editDisabled}
              onClick={() => void onSave()}
              className="h-8 min-w-28 gap-1.5 px-4 text-xs font-semibold"
            >
              {submitting
                ? <RefreshCw className="size-3.5 animate-spin" />
                : <CheckCircle2 className="size-3.5" />
              }
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}