"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RefreshCw, Save, Settings as SettingsIcon, Globe, Share2, Phone, MapPin, FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import { toastApiError } from "@/lib/toast-api-error";
import {
  fetchPublicSettings,
  upsertSettings,
  type LocalizedText,
  type SettingsLocale,
  type SettingsUpsertPayload,
  type SiteSettings,
} from "@/lib/settings-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type LocalizedForm = { en: string; ar: string };

type SettingsFormState = {
  websiteName: LocalizedForm;
  instagramLink: string;
  youtubeLink: string;
  facebookLink: string;
  contactEmail: string;
  address: LocalizedForm;
  phoneNumber: string;
  visitingHours: LocalizedForm;
  whatsappNumber: string;
  footerText: LocalizedForm;
};

function emptyLoc(): LocalizedForm {
  return { en: "", ar: "" };
}

function locFromApi(v: LocalizedText | null | undefined): LocalizedForm {
  return {
    en: typeof v?.en === "string" ? v.en : "",
    ar: typeof v?.ar === "string" ? v.ar : "",
  };
}

function formFromSettings(s: SiteSettings | null): SettingsFormState {
  return {
    websiteName: locFromApi(s?.websiteName),
    instagramLink: s?.instagramLink ?? "",
    youtubeLink: s?.youtubeLink ?? "",
    facebookLink: s?.facebookLink ?? "",
    contactEmail: s?.contactEmail ?? "",
    address: locFromApi(s?.address),
    phoneNumber: s?.phoneNumber ?? "",
    visitingHours: locFromApi(s?.visitingHours),
    whatsappNumber: s?.whatsappNumber ?? "",
    footerText: locFromApi(s?.footerText),
  };
}

function normalizeUrl(v: string): string {
  return v.trim();
}

function isValidUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function hostOf(v: string): string | null {
  try {
    return new URL(v).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isInstagramUrl(v: string): boolean {
  const h = hostOf(v);
  return !!h && (h === "instagram.com" || h.endsWith(".instagram.com"));
}

function isYoutubeUrl(v: string): boolean {
  const h = hostOf(v);
  return !!h && (h === "youtube.com" || h.endsWith(".youtube.com") || h === "youtu.be");
}

function isFacebookUrl(v: string): boolean {
  const h = hostOf(v);
  return !!h && (h === "facebook.com" || h.endsWith(".facebook.com") || h === "fb.com");
}

function normalizePhone(v: string): string {
  return v.trim();
}

function isValidPhone(v: string): boolean {
  const s = v.trim();
  if (!s) return true;
  if (!/^\+?\d+$/.test(s)) return false;
  return s.replace("+", "").length >= 7 && s.replace("+", "").length <= 20;
}

function localizedToPayload(v: LocalizedForm): LocalizedText {
  const out: LocalizedText = {};
  if (v.en.trim()) out.en = v.en.trim();
  if (v.ar.trim()) out.ar = v.ar.trim();
  return out;
}

function isEmptyLocalizedPayload(v: LocalizedText): boolean {
  return !v.en?.trim() && !v.ar?.trim();
}

function localizedEqual(a: LocalizedForm, b: LocalizedForm): boolean {
  return a.en === b.en && a.ar === b.ar;
}

function hasAnyLocalized(initial: LocalizedForm): boolean {
  return !!initial.en.trim() || !!initial.ar.trim();
}

// ─── Localized Field ──────────────────────────────────────────────────────────

/**
 * Detects the dominant script direction of a string.
 * Returns "rtl" if the string contains more Arabic/Hebrew characters than LTR ones.
 */
function detectDir(value: string): "ltr" | "rtl" {
  if (!value) return "ltr";
  const rtlChars = (value.match(/[\u0600-\u06FF\u0750-\u077F\u0590-\u05FF]/g) || []).length;
  const ltrChars = (value.match(/[a-zA-Z]/g) || []).length;
  return rtlChars > ltrChars ? "rtl" : "ltr";
}

interface LocalizedTabInputProps {
  label: string;
  value: LocalizedForm;
  onChange: (next: LocalizedForm) => void;
  multiline?: boolean;
  hint?: string;
  placeholder?: { en?: string; ar?: string };
}

function LocalizedTabInput({
  label,
  value,
  onChange,
  multiline,
  hint,
  placeholder,
}: LocalizedTabInputProps) {
  const [activeLocale, setActiveLocale] = useState<"en" | "ar">("en");

  const locales: Array<{ key: "en" | "ar"; label: string; dir: "ltr" | "rtl"; fontClass: string }> = [
    { key: "en", label: "English", dir: "ltr", fontClass: "" },
    { key: "ar", label: "العربية", dir: "rtl", fontClass: "font-arabic" },
  ];

  const active = locales.find((l) => l.key === activeLocale)!;
  const currentValue = value[activeLocale];

  // Auto-detect direction while typing for mixed input
  const inputDir = activeLocale === "ar" ? "rtl" : detectDir(currentValue) === "rtl" ? "rtl" : "ltr";

  const enFilled = !!value.en.trim();
  const arFilled = !!value.ar.trim();

  const sharedClasses = cn(
    "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors",
    "placeholder:text-muted-foreground/50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
    "disabled:cursor-not-allowed disabled:opacity-50",
    active.fontClass,
    inputDir === "rtl" ? "text-right" : "text-left"
  );

  return (
    <div className="grid gap-2">
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </Label>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        {/* Locale switcher */}
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-0.5">
          {locales.map((loc) => {
            const filled = loc.key === "en" ? enFilled : arFilled;
            return (
              <button
                key={loc.key}
                type="button"
                onClick={() => setActiveLocale(loc.key)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                  activeLocale === loc.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {loc.label}
                {filled && (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      activeLocale === loc.key ? "bg-primary" : "bg-muted-foreground/40"
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Input — single field, locale-aware */}
      <div className="relative">
        {multiline ? (
          <textarea
            dir={inputDir}
            lang={activeLocale}
            value={currentValue}
            rows={3}
            placeholder={
              activeLocale === "ar"
                ? (placeholder?.ar ?? (activeLocale === "ar" ? "أدخل النص بالعربية…" : ""))
                : (placeholder?.en ?? "")
            }
            className={cn(sharedClasses, "resize-none leading-relaxed")}
            onChange={(e) => onChange({ ...value, [activeLocale]: e.target.value })}
          />
        ) : (
          <input
            dir={inputDir}
            lang={activeLocale}
            type="text"
            value={currentValue}
            placeholder={
              activeLocale === "ar"
                ? (placeholder?.ar ?? "")
                : (placeholder?.en ?? "")
            }
            className={cn(sharedClasses, "h-9")}
            onChange={(e) => onChange({ ...value, [activeLocale]: e.target.value })}
          />
        )}

        {/* Locale ghost badge inside field */}
        <div
          className={cn(
            "pointer-events-none absolute bottom-2 flex items-center",
            inputDir === "rtl" ? "left-2.5" : "right-2.5"
          )}
        >
          <span className="rounded-sm bg-muted px-1 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground/60 tabular-nums">
            {activeLocale.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Fill status pills */}
      <div className="flex items-center gap-1.5">
        {locales.map((loc) => {
          const filled = loc.key === "en" ? enFilled : arFilled;
          return (
            <button
              key={loc.key}
              type="button"
              onClick={() => setActiveLocale(loc.key)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                filled
                  ? "border-primary/30 bg-primary/8 text-primary"
                  : "border-border/50 bg-muted/30 text-muted-foreground/60",
                activeLocale === loc.key && "ring-1 ring-primary/30"
              )}
            >
              <span
                className={cn("size-1.5 rounded-full", filled ? "bg-primary" : "bg-muted-foreground/30")}
              />
              {loc.key === "en" ? "EN" : "AR"}
              {filled ? " ✓" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-2.5 border-b border-border/40 bg-muted/20 px-5 py-3.5">
        <div className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-background shadow-sm">
          <Icon className="size-3.5 text-muted-foreground" />
        </div>
        <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-5 px-5 py-5">{children}</CardContent>
    </Card>
  );
}

// ─── Field Row ────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline gap-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </Label>
        {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function SettingsPanel() {
  const t = useTranslations("SettingsPage");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initial, setInitial] = useState<SettingsFormState>(() => ({
    websiteName: emptyLoc(),
    instagramLink: "",
    youtubeLink: "",
    facebookLink: "",
    contactEmail: "",
    address: emptyLoc(),
    phoneNumber: "",
    visitingHours: emptyLoc(),
    whatsappNumber: "",
    footerText: emptyLoc(),
  }));
  const [form, setForm] = useState<SettingsFormState>(() => initial);

  const schema = useMemo(() => {
    const optionalPlatformUrl = (platform: "instagram" | "youtube" | "facebook") =>
      z
        .string()
        .trim()
        .refine((v) => !v || isValidUrl(v), { message: t("invalidUrl") })
        .refine(
          (v) => {
            if (!v) return true;
            if (platform === "instagram") return isInstagramUrl(v);
            if (platform === "youtube") return isYoutubeUrl(v);
            return isFacebookUrl(v);
          },
          { message: t(`invalid${platform[0]!.toUpperCase()}${platform.slice(1)}Url` as any) }
        );

    return z.object({
      instagramLink: optionalPlatformUrl("instagram"),
      youtubeLink: optionalPlatformUrl("youtube"),
      facebookLink: optionalPlatformUrl("facebook"),
      contactEmail: z
        .string()
        .trim()
        .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
          message: t("invalidEmail"),
        }),
      phoneNumber: z
        .string()
        .trim()
        .refine((v) => isValidPhone(v), { message: t("invalidPhone") }),
      whatsappNumber: z
        .string()
        .trim()
        .refine((v) => isValidPhone(v), { message: t("invalidPhone") }),
    });
  }, [t]);

  const validationError = useMemo(() => {
    const r = schema.safeParse({
      instagramLink: form.instagramLink,
      youtubeLink: form.youtubeLink,
      facebookLink: form.facebookLink,
      contactEmail: form.contactEmail,
      phoneNumber: form.phoneNumber,
      whatsappNumber: form.whatsappNumber,
    });
    if (r.success) return null;
    return r.error.issues[0]?.message ?? t("invalid");
  }, [form, schema, t]);

  const hasChanges = useMemo(() => {
    return (
      !localizedEqual(form.websiteName, initial.websiteName) ||
      form.instagramLink !== initial.instagramLink ||
      form.youtubeLink !== initial.youtubeLink ||
      form.facebookLink !== initial.facebookLink ||
      form.contactEmail !== initial.contactEmail ||
      !localizedEqual(form.address, initial.address) ||
      form.phoneNumber !== initial.phoneNumber ||
      !localizedEqual(form.visitingHours, initial.visitingHours) ||
      form.whatsappNumber !== initial.whatsappNumber ||
      !localizedEqual(form.footerText, initial.footerText)
    );
  }, [form, initial]);

  const saveDisabled = submitting || loading || !hasChanges || !!validationError;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await fetchPublicSettings();
      const next = formFromSettings(s);
      setInitial(next);
      setForm(next);
    } catch (e) {
      toastApiError(e, t("loadError"));
      const next = formFromSettings(null);
      setInitial(next);
      setForm(next);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function buildPatch(): SettingsUpsertPayload {
    const patch: SettingsUpsertPayload = {};

    const maybeString = (
      key: keyof SettingsUpsertPayload,
      current: string,
      prev: string
    ) => {
      if (current === prev) return;
      (patch as any)[key] = current.trim();
    };

    const maybeLocalized = (
      key: keyof SettingsUpsertPayload,
      current: LocalizedForm,
      prev: LocalizedForm
    ) => {
      if (localizedEqual(current, prev)) return;
      const payload = localizedToPayload(current);
      if (isEmptyLocalizedPayload(payload)) {
        if (hasAnyLocalized(prev)) (patch as any)[key] = {};
        return;
      }
      const out: LocalizedText = {};
      if (current.en !== prev.en && current.en.trim()) out.en = current.en.trim();
      if (current.ar !== prev.ar && current.ar.trim()) out.ar = current.ar.trim();
      if (current.en !== prev.en && !current.en.trim()) out.en = "";
      if (current.ar !== prev.ar && !current.ar.trim()) out.ar = "";
      (patch as any)[key] = out;
    };

    maybeLocalized("websiteName", form.websiteName, initial.websiteName);
    maybeString(
      "instagramLink",
      normalizeUrl(form.instagramLink),
      normalizeUrl(initial.instagramLink)
    );
    maybeString(
      "youtubeLink",
      normalizeUrl(form.youtubeLink),
      normalizeUrl(initial.youtubeLink)
    );
    maybeString(
      "facebookLink",
      normalizeUrl(form.facebookLink),
      normalizeUrl(initial.facebookLink)
    );
    maybeString("contactEmail", form.contactEmail, initial.contactEmail);
    maybeLocalized("address", form.address, initial.address);
    maybeString(
      "phoneNumber",
      normalizePhone(form.phoneNumber),
      normalizePhone(initial.phoneNumber)
    );
    maybeLocalized("visitingHours", form.visitingHours, initial.visitingHours);
    maybeString(
      "whatsappNumber",
      normalizePhone(form.whatsappNumber),
      normalizePhone(initial.whatsappNumber)
    );
    maybeLocalized("footerText", form.footerText, initial.footerText);

    return patch;
  }

  async function onSave() {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const patch = buildPatch();
    if (!Object.keys(patch).length) return;
    setSubmitting(true);
    try {
      const updated = await upsertSettings(patch);
      const next = formFromSettings(updated);
      setInitial(next);
      setForm(next);
      toast.success(t("saveSuccess"));
    } catch (e) {
      toastApiError(e, t("saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <SettingsIcon className="size-4.5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-muted-foreground"
            disabled={loading || submitting}
            onClick={() => void load()}
            title="Reload"
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>

          {hasChanges && !loading && (
            <Badge
              variant="secondary"
              className="h-6 rounded-full px-2 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50"
            >
              Unsaved
            </Badge>
          )}

          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 rounded-lg px-3 text-xs font-medium"
            disabled={saveDisabled}
            onClick={() => void onSave()}
          >
            {submitting ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            {t("save")}
          </Button>
        </div>
      </div>

      {/* Validation banner */}
      {validationError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <span className="mt-0.5 shrink-0 text-base leading-none">⚠</span>
          {validationError}
        </div>
      )}

      {/* Skeleton */}
      {loading ? (
        <div className="space-y-4">
          {[80, 120, 140, 160, 80].map((h, i) => (
            <Skeleton key={i} className="w-full rounded-2xl" style={{ height: h }} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Identity */}
          <SectionCard icon={Globe} title={t("sectionIdentity")}>
            <LocalizedTabInput
              label={t("websiteName")}
              value={form.websiteName}
              onChange={(next) => setForm((s) => ({ ...s, websiteName: next }))}
              placeholder={{ en: "My Website", ar: "موقعي الإلكتروني" }}
            />
          </SectionCard>

          {/* Social */}
          <SectionCard icon={Share2} title={t("sectionSocial")}>
            <FieldRow label={t("instagramLink")}>
              <Input
                dir="ltr"
                value={form.instagramLink}
                className="h-9 font-mono text-sm"
                placeholder="https://instagram.com/yourhandle"
                onChange={(e) => setForm((s) => ({ ...s, instagramLink: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label={t("youtubeLink")}>
              <Input
                dir="ltr"
                value={form.youtubeLink}
                className="h-9 font-mono text-sm"
                placeholder="https://youtube.com/@yourchannel"
                onChange={(e) => setForm((s) => ({ ...s, youtubeLink: e.target.value }))}
              />
            </FieldRow>
            <FieldRow label={t("facebookLink")}>
              <Input
                dir="ltr"
                value={form.facebookLink}
                className="h-9 font-mono text-sm"
                placeholder="https://facebook.com/yourpage"
                onChange={(e) => setForm((s) => ({ ...s, facebookLink: e.target.value }))}
              />
            </FieldRow>
          </SectionCard>

          {/* Contact */}
          <SectionCard icon={Phone} title={t("sectionContact")}>
            <FieldRow label={t("contactEmail")}>
              <Input
                dir="ltr"
                type="email"
                value={form.contactEmail}
                className="h-9"
                placeholder="info@example.com"
                onChange={(e) => setForm((s) => ({ ...s, contactEmail: e.target.value }))}
              />
            </FieldRow>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow label={t("phoneNumber")}>
                <Input
                  dir="ltr"
                  value={form.phoneNumber}
                  className="h-9 tabular-nums"
                  placeholder="+966 5x xxx xxxx"
                  onChange={(e) => setForm((s) => ({ ...s, phoneNumber: e.target.value }))}
                />
              </FieldRow>
              <FieldRow label={t("whatsappNumber")}>
                <Input
                  dir="ltr"
                  value={form.whatsappNumber}
                  className="h-9 tabular-nums"
                  placeholder="+966 5x xxx xxxx"
                  onChange={(e) => setForm((s) => ({ ...s, whatsappNumber: e.target.value }))}
                />
              </FieldRow>
            </div>
          </SectionCard>

          {/* Location */}
          <SectionCard icon={MapPin} title={t("sectionLocation")}>
            <LocalizedTabInput
              label={t("address")}
              value={form.address}
              onChange={(next) => setForm((s) => ({ ...s, address: next }))}
              multiline
              placeholder={{
                en: "123 Main St, City, Country",
                ar: "١٢٣ شارع الرئيسي، المدينة، الدولة",
              }}
            />
            <Separator />
            <LocalizedTabInput
              label={t("visitingHours")}
              value={form.visitingHours}
              onChange={(next) => setForm((s) => ({ ...s, visitingHours: next }))}
              multiline
              placeholder={{
                en: "Sun – Thu: 9:00 AM – 5:00 PM",
                ar: "الأحد – الخميس: ٩:٠٠ ص – ٥:٠٠ م",
              }}
            />
          </SectionCard>

          {/* Footer */}
          <SectionCard icon={FileText} title={t("sectionFooter")}>
            <LocalizedTabInput
              label={t("footerText")}
              value={form.footerText}
              onChange={(next) => setForm((s) => ({ ...s, footerText: next }))}
              multiline
              placeholder={{
                en: "© 2025 Your Company. All rights reserved.",
                ar: "© ٢٠٢٥ شركتك. جميع الحقوق محفوظة.",
              }}
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}