"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { toastApiError } from "@/lib/toast-api-error";
import { fetchFarm, type FarmLocale, upsertFarm } from "@/lib/farm-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type JsonObject = Record<string, unknown>;
type SpotlightUpload = File | null;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function defaultLocaleContent(): JsonObject {
  return {
    metaDescription: "",
    intro: { title: "", lead: "", paragraphs: [""] },
    pillars: [{ icon: "", title: "", body: "" }],
    focusedProgram: { title: "", items: [{ title: "", body: "" }] },
    stats: [{ value: "", label: "" }],
    spotlights: [{ title: "", body: "", image: { src: "", alt: "" } }],
    heritageSectionKicker: "",
    heritageSectionTitle: "",
    heritage: [{ year: "", title: "", body: "" }],
    gallery: { title: "", images: [{ src: "", alt: "" }] },
    cta: { label: "", secondaryLabel: "" },
  };
}

const FIXED_COUNTS = {
  pillars: 3,
  focusedItems: 4,
  stats: 3,
  spotlights: 2,
  heritage: 5,
} as const;

function ensureArrayLength<T>(arr: T[], count: number, makeDefault: () => T): T[] {
  const next = arr.slice(0, count);
  while (next.length < count) next.push(makeDefault());
  return next;
}

function normalizeLocaleContent(input: unknown): JsonObject {
  const base = defaultLocaleContent();
  if (!input || typeof input !== "object" || Array.isArray(input)) return base;
  const merged = { ...base, ...(input as JsonObject) };
  const mergeObj = (k: string, fallback: JsonObject) => {
    const v = merged[k];
    merged[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...fallback, ...(v as JsonObject) } : fallback;
  };
  mergeObj("intro", base.intro as JsonObject);
  mergeObj("focusedProgram", base.focusedProgram as JsonObject);
  mergeObj("gallery", base.gallery as JsonObject);
  mergeObj("cta", base.cta as JsonObject);
  const mergedRec = merged as Record<string, unknown>;
  const baseRec = base as Record<string, unknown>;
  if (!Array.isArray(mergedRec.pillars)) mergedRec.pillars = clone(baseRec.pillars);
  if (!Array.isArray(mergedRec.stats)) mergedRec.stats = clone(baseRec.stats);
  if (!Array.isArray(mergedRec.spotlights)) mergedRec.spotlights = clone(baseRec.spotlights);
  if (!Array.isArray(mergedRec.heritage)) mergedRec.heritage = clone(baseRec.heritage);
  const introRec = mergedRec.intro as Record<string, unknown>;
  const focusedRec = mergedRec.focusedProgram as Record<string, unknown>;
  const galleryRec = mergedRec.gallery as Record<string, unknown>;
  if (!Array.isArray(introRec.paragraphs)) introRec.paragraphs = clone((baseRec.intro as Record<string, unknown>).paragraphs);
  if (!Array.isArray(focusedRec.items)) focusedRec.items = clone((baseRec.focusedProgram as Record<string, unknown>).items);
  if (!Array.isArray(galleryRec.images)) galleryRec.images = clone((baseRec.gallery as Record<string, unknown>).images);
  mergedRec.pillars = ensureArrayLength(
    Array.isArray(mergedRec.pillars) ? (mergedRec.pillars as JsonObject[]) : [],
    FIXED_COUNTS.pillars,
    () => ({ icon: "", title: "", body: "" }),
  );
  focusedRec.items = ensureArrayLength(
    Array.isArray(focusedRec.items) ? (focusedRec.items as JsonObject[]) : [],
    FIXED_COUNTS.focusedItems,
    () => ({ title: "", body: "" }),
  );
  mergedRec.stats = ensureArrayLength(
    Array.isArray(mergedRec.stats) ? (mergedRec.stats as JsonObject[]) : [],
    FIXED_COUNTS.stats,
    () => ({ value: "", label: "" }),
  );
  mergedRec.spotlights = ensureArrayLength(
    Array.isArray(mergedRec.spotlights) ? (mergedRec.spotlights as JsonObject[]) : [],
    FIXED_COUNTS.spotlights,
    () => ({ title: "", body: "", image: { src: "", alt: "" } }),
  );
  mergedRec.heritage = ensureArrayLength(
    Array.isArray(mergedRec.heritage) ? (mergedRec.heritage as JsonObject[]) : [],
    FIXED_COUNTS.heritage,
    () => ({ year: "", title: "", body: "" }),
  );
  return merged;
}

export function FarmPanel() {
  const t = useTranslations("FarmAdmin");
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(true);
  const [contentEn, setContentEn] = useState<JsonObject>(defaultLocaleContent());
  const [contentAr, setContentAr] = useState<JsonObject>(defaultLocaleContent());
  const [tab, setTab] = useState<FarmLocale>(locale === "ar" ? "ar" : "en");
  const [spotlightUploads, setSpotlightUploads] = useState<SpotlightUpload[]>(
    Array.from({ length: FIXED_COUNTS.spotlights }, () => null),
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const row = await fetchFarm();
        if (!alive) return;
        setActive(row.isActive !== false);
        setContentEn(normalizeLocaleContent(row.translations.en));
        setContentAr(normalizeLocaleContent(row.translations.ar));
        setSpotlightUploads(Array.from({ length: FIXED_COUNTS.spotlights }, () => null));
      } catch (e) {
        toastApiError(e, t("loadError"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  const canSave = useMemo(() => !loading && !saving, [loading, saving]);

  function updateLocale(path: string, value: string, target: FarmLocale) {
    const setter = target === "en" ? setContentEn : setContentAr;
    setter((prev) => {
      const next = clone(prev);
      const parts = path.split(".");
      let cur: unknown = next;
      for (let i = 0; i < parts.length - 1; i += 1) {
        const p = parts[i]!;
        if (!cur || typeof cur !== "object") return prev;
        const rec = cur as Record<string, unknown>;
        if (rec[p] == null || typeof rec[p] !== "object") rec[p] = {};
        cur = rec[p];
      }
      if (!cur || typeof cur !== "object") return prev;
      (cur as Record<string, unknown>)[parts[parts.length - 1]!] = value;
      return next;
    });
  }

  function setSpotlightUpload(index: number, file: File | null) {
    setSpotlightUploads((prev) => {
      const next = [...prev];
      next[index] = file;
      return next;
    });
  }

  function readSpotlightImage(content: JsonObject, index: number): string {
    const spots = Array.isArray(content.spotlights) ? content.spotlights : [];
    const row = (spots[index] ?? {}) as JsonObject;
    const image = (row.image ?? {}) as JsonObject;
    return typeof image.src === "string" ? image.src : "";
  }

  async function onSave() {
    const payload = { en: contentEn, ar: contentAr };
    const uploadFiles: File[] = [];
    const imageBindings: Array<{ locale: FarmLocale; path: string; uploadIndex: number }> = [];
    spotlightUploads.forEach((file, idx) => {
      if (!file) return;
      const enUploadIndex = uploadFiles.push(file) - 1;
      imageBindings.push({ locale: "en", path: `spotlights.${idx}.image.src`, uploadIndex: enUploadIndex });
      imageBindings.push({ locale: "ar", path: `spotlights.${idx}.image.src`, uploadIndex: enUploadIndex });
    });

    setSaving(true);
    try {
      await upsertFarm({
        isActive: active,
        contentJson: JSON.stringify(payload),
        imageBindingsJson: imageBindings.length ? JSON.stringify(imageBindings) : undefined,
        images: uploadFiles,
      });
      toast.success(t("saveSuccess"));
      setSpotlightUploads(Array.from({ length: FIXED_COUNTS.spotlights }, () => null));
    } catch (e) {
      toastApiError(e, t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="farm-active">{t("isActive")}</Label>
          <Switch id="farm-active" checked={active} onCheckedChange={setActive} />
          <Button type="button" onClick={() => void onSave()} disabled={!canSave}>
            <Save className="me-1 size-4" /> {t("save")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("sectionsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab((v === "ar" ? "ar" : "en") as FarmLocale)}>
            <TabsList>
              <TabsTrigger value="en">{t("langEn")}</TabsTrigger>
              <TabsTrigger value="ar">{t("langAr")}</TabsTrigger>
            </TabsList>
            <TabsContent value="en" className="space-y-3">
              <LocaleForm
                target="en"
                content={contentEn}
                updateLocale={updateLocale}
              />
            </TabsContent>
            <TabsContent value="ar" className="space-y-3">
              <LocaleForm
                target="ar"
                content={contentAr}
                updateLocale={updateLocale}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spotlight Images (shared across EN/AR)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: FIXED_COUNTS.spotlights }).map((_, idx) => {
            const pending = spotlightUploads[idx];
            const enCurrent = readSpotlightImage(contentEn, idx);
            const arCurrent = readSpotlightImage(contentAr, idx);
            const current = enCurrent || arCurrent;
            return (
              <div key={`spotlight-upload-${idx}`} className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-semibold">Spotlight #{idx + 1}</p>
                <div className="space-y-2">
                  <Label className="text-xs">Shared image</Label>
                  {current ? <p className="text-xs text-muted-foreground break-all">Current: {current}</p> : null}
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => setSpotlightUpload(idx, e.target.files?.[0] ?? null)}
                  />
                  {pending ? <p className="text-xs text-muted-foreground">Pending: {pending.name}</p> : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  The uploaded image is applied to both locales for this spotlight.
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function LocaleForm({
  target,
  content,
  updateLocale,
}: {
  target: FarmLocale;
  content: JsonObject;
  updateLocale: (path: string, value: string, target: FarmLocale) => void;
}) {
  const textInput = (label: string, path: string, value: unknown, multiline = false) => (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea rows={4} value={typeof value === "string" ? value : ""} onChange={(e) => updateLocale(path, e.target.value, target)} />
      ) : (
        <Input value={typeof value === "string" ? value : ""} onChange={(e) => updateLocale(path, e.target.value, target)} />
      )}
    </div>
  );

  const intro = (content.intro as JsonObject) ?? {};
  const paragraphs = Array.isArray(intro.paragraphs) ? intro.paragraphs : [];
  const pillars = Array.isArray(content.pillars) ? content.pillars : [];
  const stats = Array.isArray(content.stats) ? content.stats : [];
  const spotlights = Array.isArray(content.spotlights) ? content.spotlights : [];
  const heritage = Array.isArray(content.heritage) ? content.heritage : [];

  return (
    <div className="space-y-5">
      <Card><CardContent className="pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">SEO</p>
        {textInput("Meta Description", "metaDescription", content.metaDescription, true)}
      </CardContent></Card>

      <Card><CardContent className="pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Intro</p>
        {textInput("Intro Title", "intro.title", intro.title)}
        {textInput("Intro Lead", "intro.lead", intro.lead, true)}
        <div className="space-y-2">
          <Label>Intro Paragraphs</Label>
          {paragraphs.map((p, i) => (
            <Textarea key={`p-${i}`} rows={3} value={String(p ?? "")} onChange={(e) => updateLocale(`intro.paragraphs.${i}`, e.target.value, target)} />
          ))}
        </div>
      </CardContent></Card>

      <ArrayObjectEditor label="Vision / Approach / Mission (3)" path="pillars" rows={pillars} fields={[["title","Title"],["body","Body"]]} target={target} updateLocale={updateLocale} />
      <ArrayObjectEditor label="Stats (3)" path="stats" rows={stats} fields={[["value","Value"],["label","Label"]]} target={target} updateLocale={updateLocale} />
      <ArrayObjectEditor label="Spotlights (2) — text content" path="spotlights" rows={spotlights} fields={[["title","Title"],["body","Body"],["image.alt","Image Alt"]]} target={target} updateLocale={updateLocale} />
      <Card><CardContent className="pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Heritage</p>
        {textInput("A Legacy Built Over Decades - Kicker", "heritageSectionKicker", content.heritageSectionKicker)}
        {textInput("A Legacy Built Over Decades - Title", "heritageSectionTitle", content.heritageSectionTitle)}
        <ArrayObjectEditor label="Legacy Cards (Max 5)" path="heritage" rows={heritage} fields={[["year","Year"],["title","Title"],["body","Body"]]} target={target} updateLocale={updateLocale} />
      </CardContent></Card>
    </div>
  );
}

function ArrayObjectEditor({
  label,
  path,
  rows,
  fields,
  target,
  updateLocale,
}: {
  label: string;
  path: string;
  rows: unknown[];
  fields: Array<[string, string]>;
  target: FarmLocale;
  updateLocale: (path: string, value: string, target: FarmLocale) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <Label>{label}</Label>
        {rows.map((row, i) => (
          <div key={`${path}-${i}`} className="rounded-md border p-3 space-y-2">
            {fields.map(([key, title]) => (
              <div key={`${path}-${i}-${key}`} className="grid gap-1">
                <Label className="text-xs">{title}</Label>
                <Input
                  value={String(readNested(row, key) ?? "")}
                  onChange={(e) => updateLocale(`${path}.${i}.${key}`, e.target.value, target)}
                />
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function readNested(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return "";
  const parts = key.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

