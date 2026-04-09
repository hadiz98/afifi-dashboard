"use client";

import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export type FarmLocale = "en" | "ar";

export type FarmRootTranslation = {
  metaDescription: string;
  heroKicker: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: { src: string; alt: string };
  intro: { title: string; lead: string; paragraphs: string[] };
  pillars: Array<{ icon: string; title: string; body: string }>;
  focusedProgram: { title: string; items: Array<{ title: string; body: string }> };
  stats: Array<{ value: string; label: string }>;
  spotlights: Array<{ title: string; body: string; image: { src: string; alt: string } }>;
  heritageSectionKicker: string;
  heritageSectionTitle: string;
  heritage: Array<{ year: string; title: string; body: string }>;
  gallery: { title: string; images: Array<{ src: string; alt: string }> };
  cta: { label: string; secondaryLabel: string };
};

export type FarmStaff = {
  id: string;
  isActive: boolean;
  translations: Partial<Record<FarmLocale, FarmRootTranslation>>;
};

function normalizeFarm(raw: unknown): FarmStaff | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  if (!id) return null;
  const isActive = o.isActive !== false;
  const out: FarmStaff = { id, isActive, translations: {} };
  const tr = o.translations;
  if (tr && typeof tr === "object" && !Array.isArray(tr)) {
    for (const loc of ["en", "ar"] as const) {
      const t = (tr as Record<string, unknown>)[loc];
      if (!t || typeof t !== "object" || Array.isArray(t)) continue;
      out.translations[loc] = t as FarmRootTranslation;
    }
  }
  return out;
}

export async function fetchFarm(): Promise<FarmStaff> {
  const res = await apiFetch("/api/farm", { method: "GET" });
  const raw = await readApiData<unknown>(res);
  const item = normalizeFarm(raw);
  if (!item) throw new ApiError("Invalid farm response", { statusCode: 502 });
  return item;
}

export async function upsertFarm(params: {
  isActive: boolean;
  contentJson: string;
  imageBindingsJson?: string;
  images?: File[];
}): Promise<FarmStaff> {
  const fd = new FormData();
  fd.append("isActive", params.isActive ? "1" : "0");
  fd.append("content", params.contentJson);
  if (params.imageBindingsJson) fd.append("imageBindings", params.imageBindingsJson);
  for (const f of params.images ?? []) {
    fd.append("images", f);
  }
  const res = await apiFetch("/api/farm", { method: "PUT", body: fd });
  const raw = await readApiData<unknown>(res);
  const item = normalizeFarm(raw);
  if (!item) throw new ApiError("Invalid farm upsert response", { statusCode: 502 });
  return item;
}

