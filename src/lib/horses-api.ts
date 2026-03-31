"use client";

import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export type HorseLocale = "en" | "ar";
export type HorseCategory = "stallion" | "mare" | "filly" | "colt";

export type HorseTranslation = {
  locale: HorseLocale;
  name: string;
  subtitle: string;
  shortBio: string;
  description?: string | null;
  tags: string[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  sireName?: string | null;
  damName?: string | null;
  bloodline?: string | null;
};

export type HorseAdminListItem = {
  id: string;
  slug: string;
  category: HorseCategory;
  coverImage?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  translations: HorseTranslation[];
};

export type HorseDetails = HorseAdminListItem & {
  birthDate?: string | null;
  color?: string | null;
  heightCm?: number | null;
  breeder?: string | null;
  owner?: string | null;
  notes?: string | null;
  media?: unknown[];
  awards?: unknown[];
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

export function normalizeHorseCoverImagePath(v: string): string {
  const value = v.trim();
  if (!value) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const base = apiBase();
  if (value.startsWith("/")) return base ? `${base}${value}` : value;
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("images/horses/")) {
    const prefixed = `/${normalized}`;
    return base ? `${base}${prefixed}` : prefixed;
  }
  const prefixed = `/images/horses/${normalized.split("/").pop() ?? normalized}`;
  return base ? `${base}${prefixed}` : prefixed;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function pickBoolean(obj: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      if (v === "true" || v === "1") return true;
      if (v === "false" || v === "0") return false;
    }
    if (typeof v === "number") {
      if (v === 1) return true;
      if (v === 0) return false;
    }
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | null | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  if (raw === null || raw === undefined) return [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
      }
    } catch {
      // fall through
    }
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeTranslation(data: unknown): HorseTranslation | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const localeRaw = pickString(o, ["locale"])?.toLowerCase();
  if (localeRaw !== "en" && localeRaw !== "ar") return null;
  const name = pickString(o, ["name"]) ?? "";
  // For admin list: payload may exclude description; allow missing.
  return {
    locale: localeRaw,
    name,
    subtitle: pickString(o, ["subtitle"]) ?? "",
    shortBio: pickString(o, ["shortBio", "short_bio"]) ?? "",
    description: pickString(o, ["description"]) ?? null,
    tags: normalizeTags(o.tags),
    metaTitle: pickString(o, ["metaTitle", "meta_title"]) ?? null,
    metaDescription: pickString(o, ["metaDescription", "meta_description"]) ?? null,
    sireName: pickString(o, ["sireName", "sire_name"]) ?? null,
    damName: pickString(o, ["damName", "dam_name"]) ?? null,
    bloodline: pickString(o, ["bloodline"]) ?? null,
  };
}

function normalizeCategory(v: unknown): HorseCategory | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase();
  if (s === "stallion" || s === "mare" || s === "filly" || s === "colt") return s;
  return null;
}

export function normalizeHorseAdminListItem(data: unknown): HorseAdminListItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = pickString(o, ["id", "_id"]) ?? (typeof o.id !== "undefined" ? String(o.id) : undefined);
  const slug = pickString(o, ["slug"]);
  const category = normalizeCategory(o.category);
  if (!id || !slug || !category) return null;
  const translationsRaw = o.translations;
  const translations = Array.isArray(translationsRaw)
    ? translationsRaw
        .map((x) => normalizeTranslation(x))
        .filter((x): x is HorseTranslation => x !== null)
    : [];
  const coverImageRaw = pickString(o, ["coverImage", "cover_image"]);
  return {
    id,
    slug,
    category,
    coverImage: coverImageRaw ? normalizeHorseCoverImagePath(coverImageRaw) : null,
    isActive: pickBoolean(o, ["isActive", "is_active"]) ?? undefined,
    createdAt: pickString(o, ["createdAt", "created_at"]) ?? null,
    updatedAt: pickString(o, ["updatedAt", "updated_at"]) ?? null,
    deletedAt: pickString(o, ["deletedAt", "deleted_at"]) ?? null,
    translations,
  };
}

export function normalizeHorseDetails(data: unknown): HorseDetails | null {
  const base = normalizeHorseAdminListItem(data);
  if (!base) return null;
  const o = data as Record<string, unknown>;
  return {
    ...base,
    birthDate: pickString(o, ["birthDate", "birth_date"]) ?? null,
    color: pickString(o, ["color"]) ?? null,
    heightCm: pickNumber(o, ["heightCm", "height_cm"]) ?? null,
    breeder: pickString(o, ["breeder"]) ?? null,
    owner: pickString(o, ["owner"]) ?? null,
    notes: pickString(o, ["notes"]) ?? null,
    media: Array.isArray(o.media) ? (o.media as unknown[]) : [],
    awards: Array.isArray(o.awards) ? (o.awards as unknown[]) : [],
  };
}

export type HorsesPageResult = {
  rows: HorseAdminListItem[];
  meta: { total: number; page: number; limit: number; pages: number };
};

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function fetchHorsesPage(params?: {
  page?: number;
  limit?: number;
}): Promise<HorsesPageResult> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const res = await apiFetch(`/api/horses?page=${page}&limit=${limit}`, { method: "GET" });

  // Support envelopes like:
  // - { data: Horse[], meta: ... }
  // - { success: true, data: { data: Horse[], meta: ... } }
  const body = await parseJson(res);
  if (!res.ok) throw ApiError.fromBody(body, res.status);
  if (!body || typeof body !== "object") {
    return { rows: [], meta: { total: 0, page, limit, pages: 1 } };
  }
  const record = body as Record<string, unknown>;
  if (record.success === false) throw ApiError.fromBody(body, res.status);
  const outerData = record.data;
  const inner =
    outerData && typeof outerData === "object"
      ? (outerData as Record<string, unknown>)
      : null;
  const list =
    (inner && Array.isArray(inner.data) ? inner.data : null) ??
    (Array.isArray(outerData) ? outerData : null) ??
    (Array.isArray(record.data) ? record.data : null);
  const meta =
    (inner?.meta as Record<string, unknown> | undefined) ??
    (record.meta as Record<string, unknown> | undefined);

  const rows = Array.isArray(list)
    ? list
        .map((x) => normalizeHorseAdminListItem(x))
        .filter((x): x is HorseAdminListItem => x !== null)
    : [];

  const total = typeof meta?.total === "number" ? meta.total : rows.length;
  const metaPage = typeof meta?.page === "number" ? meta.page : page;
  const metaLimit = typeof meta?.limit === "number" ? meta.limit : limit;
  const pages =
    typeof meta?.pages === "number"
      ? meta.pages
      : Math.max(1, Math.ceil(total / Math.max(1, metaLimit)) || 1);

  return { rows, meta: { total, page: metaPage, limit: metaLimit, pages } };
}

export async function fetchHorseById(id: string): Promise<HorseDetails> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(id)}`, { method: "GET" });
  const raw = await readApiData<unknown>(res);
  const item = normalizeHorseDetails(raw);
  if (!item) throw new ApiError("Invalid horse response", { statusCode: 502 });
  return item;
}

export async function createHorse(form: FormData): Promise<HorseDetails> {
  const res = await apiFetch("/api/horses", { method: "POST", body: form });
  const raw = await readApiData<unknown>(res);
  const item = normalizeHorseDetails(raw);
  if (!item) throw new ApiError("Invalid horse create response", { statusCode: 502 });
  return item;
}

export async function updateHorse(id: string, form: FormData): Promise<HorseDetails> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(id)}`, { method: "PATCH", body: form });
  const raw = await readApiData<unknown>(res);
  const item = normalizeHorseDetails(raw);
  if (!item) throw new ApiError("Invalid horse update response", { statusCode: 502 });
  return item;
}

export async function deleteHorse(id: string): Promise<void> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(id)}`, { method: "DELETE" });
  await readApiData<unknown>(res);
}

