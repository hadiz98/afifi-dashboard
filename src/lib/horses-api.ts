"use client";

import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export type HorseLocale = "en" | "ar";
export type HorseCategory = "stallion" | "mare" | "filly" | "colt";

/** Structured pedigree on the horse record (not localized). API may send object or JSON string. */
export type HorsePedigreeRelative = {
  name?: string | null;
  birthDate?: string | null;
  color?: string | null;
};

export type HorsePedigree = {
  father?: HorsePedigreeRelative | null;
  mother?: HorsePedigreeRelative | null;
  grandfather?: HorsePedigreeRelative | null;
  grandmother?: HorsePedigreeRelative | null;
};

export type HorseTranslation = {
  locale: HorseLocale;
  name: string;
  subtitle: string;
  shortBio: string;
  description?: string | null;
  tags: string[];
  metaTitle?: string | null;
  metaDescription?: string | null;
  /** Localized coat color (README); legacy APIs may only expose root `HorseDetails.color`). */
  color?: string | null;
  breeder?: string | null;
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
  /** Legacy/root color when translation-level `color` is absent */
  color?: string | null;
  heightCm?: number | null;
  /** Legacy/root breeder when translation-level `breeder` is absent */
  breeder?: string | null;
  owner?: string | null;
  notes?: string | null;
  pedigree?: HorsePedigree | null;
  media?: HorseMedia[];
  awards?: HorseAward[];
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

export function normalizeHorseMediaUrl(v: string): string {
  // Media URLs are expected to behave like coverImage (relative path stored by API).
  return normalizeHorseCoverImagePath(v);
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

function readOptionalTrimmedString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    if (!(key in obj)) continue;
    const v = obj[key];
    if (v === null || v === undefined) continue;
    if (typeof v === "string") return v.trim() || null;
  }
  return null;
}

function normalizePedigreeRelative(data: unknown): HorsePedigreeRelative | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const name = readOptionalTrimmedString(o, ["name"]);
  const birthDate = readOptionalTrimmedString(o, ["birthDate", "birth_date"]);
  const color = readOptionalTrimmedString(o, ["color"]);
  if (!name && !birthDate && !color) return null;
  return { name: name ?? null, birthDate: birthDate ?? null, color: color ?? null };
}

export function normalizePedigreeRaw(raw: unknown): HorsePedigree | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s || s === "{}") return null;
    try {
      const parsed = JSON.parse(s) as unknown;
      return normalizePedigreeRaw(parsed);
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const father = normalizePedigreeRelative(o.father);
  const mother = normalizePedigreeRelative(o.mother);
  const grandfather = normalizePedigreeRelative(o.grandfather);
  const grandmother = normalizePedigreeRelative(o.grandmother);
  if (!father && !mother && !grandfather && !grandmother) return null;
  return { father, mother, grandfather, grandmother };
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
    color: readOptionalTrimmedString(o, ["color"]),
    breeder: readOptionalTrimmedString(o, ["breeder"]),
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

export type HorseMedia = {
  id: string;
  url: string;
  caption?: string | null;
  sortOrder?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type HorseAward = {
  id: string;
  year: number;
  eventName: string;
  title: string;
  placing?: string | null;
  location?: string | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function normalizeHorseMedia(data: unknown): HorseMedia | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = pickString(o, ["id", "_id"]) ?? (typeof o.id !== "undefined" ? String(o.id) : undefined);
  const urlRaw = pickString(o, ["url", "path"]);
  if (!id || !urlRaw) return null;
  return {
    id,
    url: normalizeHorseMediaUrl(urlRaw),
    caption: pickString(o, ["caption"]) ?? null,
    sortOrder: pickNumber(o, ["sortOrder", "sort_order"]) ?? null,
    createdAt: pickString(o, ["createdAt", "created_at"]) ?? null,
    updatedAt: pickString(o, ["updatedAt", "updated_at"]) ?? null,
  };
}

function normalizeHorseAward(data: unknown): HorseAward | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = pickString(o, ["id", "_id"]) ?? (typeof o.id !== "undefined" ? String(o.id) : undefined);
  const year = pickNumber(o, ["year"]);
  const eventName = pickString(o, ["eventName", "event_name"]);
  const title = pickString(o, ["title"]);
  if (!id || typeof year !== "number" || !eventName || !title) return null;
  return {
    id,
    year,
    eventName,
    title,
    placing: pickString(o, ["placing"]) ?? null,
    location: pickString(o, ["location"]) ?? null,
    notes: pickString(o, ["notes"]) ?? null,
    createdAt: pickString(o, ["createdAt", "created_at"]) ?? null,
    updatedAt: pickString(o, ["updatedAt", "updated_at"]) ?? null,
  };
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
  const pedigreeRaw = o.pedigree;
  return {
    ...base,
    birthDate: pickString(o, ["birthDate", "birth_date"]) ?? null,
    color: pickString(o, ["color"]) ?? null,
    heightCm: pickNumber(o, ["heightCm", "height_cm"]) ?? null,
    breeder: pickString(o, ["breeder"]) ?? null,
    owner: pickString(o, ["owner"]) ?? null,
    notes: pickString(o, ["notes"]) ?? null,
    pedigree: normalizePedigreeRaw(pedigreeRaw),
    media: Array.isArray(o.media)
      ? o.media
          .map((x) => normalizeHorseMedia(x))
          .filter((x): x is HorseMedia => x !== null)
      : [],
    awards: Array.isArray(o.awards)
      ? o.awards
          .map((x) => normalizeHorseAward(x))
          .filter((x): x is HorseAward => x !== null)
      : [],
  };
}

export type HorsesPageResult = {
  rows: HorseAdminListItem[];
  meta: { total: number; page: number; limit: number; pages: number };
};

export type PublicHorseListItem = {
  slug: string;
  category: HorseCategory;
  coverImage?: string | null;
  pedigree?: HorsePedigree | null;
  translation: {
    locale: HorseLocale;
    name: string;
    subtitle: string;
    shortBio: string;
    tags: string[];
    color?: string | null;
  } | null;
};

export type PublicHorseDetails = {
  slug: string;
  category: HorseCategory;
  coverImage?: string | null;
  birthDate?: string | null;
  color?: string | null;
  heightCm?: number | null;
  breeder?: string | null;
  owner?: string | null;
  notes?: string | null;
  pedigree?: HorsePedigree | null;
  translation: HorseTranslation | null;
  media: HorseMedia[];
  awards: HorseAward[];
};

function normalizePublicTranslation(data: unknown, locale: HorseLocale): PublicHorseListItem["translation"] {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  return {
    locale,
    name: pickString(o, ["name"]) ?? "",
    subtitle: pickString(o, ["subtitle"]) ?? "",
    shortBio: pickString(o, ["shortBio", "short_bio"]) ?? "",
    tags: normalizeTags(o.tags),
    color: readOptionalTrimmedString(o, ["color"]),
  };
}

function normalizePublicHorseListItem(data: unknown, locale: HorseLocale): PublicHorseListItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const slug = pickString(o, ["slug"]);
  const category = normalizeCategory(o.category);
  if (!slug || !category) return null;
  const coverImageRaw = pickString(o, ["coverImage", "cover_image"]);
  // Backend says: list returns translation fields for chosen locale.
  // It may be nested under `translation` or flattened.
  const translation =
    normalizePublicTranslation(o.translation, locale) ?? normalizePublicTranslation(o, locale);
  return {
    slug,
    category,
    coverImage: coverImageRaw ? normalizeHorseCoverImagePath(coverImageRaw) : null,
    pedigree: normalizePedigreeRaw(o.pedigree),
    translation,
  };
}

function normalizePublicHorseDetails(data: unknown, locale: HorseLocale): PublicHorseDetails | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const slug = pickString(o, ["slug"]);
  const category = normalizeCategory(o.category);
  if (!slug || !category) return null;
  const coverImageRaw = pickString(o, ["coverImage", "cover_image"]);
  const translation =
    normalizeTranslation(o.translation) ??
    normalizeTranslation({
      ...(o.translation as Record<string, unknown> | undefined),
      locale,
    });
  const media = Array.isArray(o.media)
    ? o.media.map((x) => normalizeHorseMedia(x)).filter((x): x is HorseMedia => x !== null)
    : [];
  const awards = Array.isArray(o.awards)
    ? o.awards.map((x) => normalizeHorseAward(x)).filter((x): x is HorseAward => x !== null)
    : [];
  const trColor = translation?.color ?? null;
  const trBreeder = translation?.breeder ?? null;
  const rootColor = pickString(o, ["color"]) ?? null;
  const rootBreeder = pickString(o, ["breeder"]) ?? null;
  return {
    slug,
    category,
    coverImage: coverImageRaw ? normalizeHorseCoverImagePath(coverImageRaw) : null,
    birthDate: pickString(o, ["birthDate", "birth_date"]) ?? null,
    color: trColor ?? rootColor,
    heightCm: pickNumber(o, ["heightCm", "height_cm"]) ?? null,
    breeder: trBreeder ?? rootBreeder,
    owner: pickString(o, ["owner"]) ?? null,
    notes: pickString(o, ["notes"]) ?? null,
    pedigree: normalizePedigreeRaw(o.pedigree),
    translation,
    media,
    awards,
  };
}

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

export async function fetchPublicHorsesPage(params: {
  locale: HorseLocale;
  page?: number;
  limit?: number;
  category?: HorseCategory;
  activeOnly?: boolean;
}): Promise<{ rows: PublicHorseListItem[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const q = new URLSearchParams();
  q.set("locale", params.locale);
  q.set("page", String(page));
  q.set("limit", String(limit));
  if (params.category) q.set("category", params.category);
  if (typeof params.activeOnly === "boolean") q.set("activeOnly", params.activeOnly ? "true" : "false");

  const res = await apiFetch(`/api/public/horses?${q.toString()}`, { method: "GET" });
  const body = await parseJson(res);
  if (!res.ok) throw ApiError.fromBody(body, res.status);
  if (!body || typeof body !== "object") {
    return { rows: [], meta: { total: 0, page, limit, pages: 1 } };
  }
  const record = body as Record<string, unknown>;
  if (record.success === false) throw ApiError.fromBody(body, res.status);
  const outerData = record.data;
  const inner = outerData && typeof outerData === "object" ? (outerData as Record<string, unknown>) : null;
  const list =
    (inner && Array.isArray(inner.data) ? inner.data : null) ??
    (Array.isArray(outerData) ? outerData : null) ??
    (Array.isArray(record.data) ? record.data : null);
  const meta =
    (inner?.meta as Record<string, unknown> | undefined) ??
    (record.meta as Record<string, unknown> | undefined);

  const rows = Array.isArray(list)
    ? list
        .map((x) => normalizePublicHorseListItem(x, params.locale))
        .filter((x): x is PublicHorseListItem => x !== null)
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

export async function fetchPublicHorseBySlug(params: { slug: string; locale: HorseLocale }): Promise<PublicHorseDetails> {
  const q = new URLSearchParams();
  q.set("locale", params.locale);
  const res = await apiFetch(`/api/public/horses/${encodeURIComponent(params.slug)}?${q.toString()}`, { method: "GET" });
  const raw = await readApiData<unknown>(res);
  const item = normalizePublicHorseDetails(raw, params.locale);
  if (!item) throw new ApiError("Invalid public horse response", { statusCode: 502 });
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

function unwrapListFromReadApi(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const data = o.data;
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      const inner = data as Record<string, unknown>;
      if (Array.isArray(inner.data)) return inner.data;
    }
  }
  return [];
}

export async function fetchHorseMedia(horseId: string): Promise<HorseMedia[]> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(horseId)}/media`, { method: "GET" });
  const raw = await readApiData<unknown>(res);
  return unwrapListFromReadApi(raw)
    .map((x) => normalizeHorseMedia(x))
    .filter((x): x is HorseMedia => x !== null)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * POST /api/horses/:id/media — multipart field `files` (1–10 images).
 * Optional `caption` / `sortOrder` apply to each new row; backend uses sortOrder for the first file then +1.
 */
export async function addHorseMedia(
  horseId: string,
  params: { files: File[]; caption?: string; sortOrder?: number }
): Promise<HorseMedia[]> {
  if (!params.files.length) {
    throw new ApiError("At least one image file is required", { statusCode: 400 });
  }
  const fd = new FormData();
  for (const f of params.files) {
    fd.append("files", f);
  }
  if (params.caption?.trim()) fd.append("caption", params.caption.trim());
  if (typeof params.sortOrder === "number" && Number.isFinite(params.sortOrder)) {
    fd.append("sortOrder", String(params.sortOrder));
  }
  const res = await apiFetch(`/api/horses/${encodeURIComponent(horseId)}/media`, { method: "POST", body: fd });
  const raw = await readApiData<unknown>(res);
  const items = unwrapListFromReadApi(raw)
    .map((x) => normalizeHorseMedia(x))
    .filter((x): x is HorseMedia => x !== null);
  if (!items.length) throw new ApiError("Invalid media create response", { statusCode: 502 });
  return items;
}

export async function replaceHorseMediaFile(horseId: string, mediaId: string, file: File): Promise<HorseMedia> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await apiFetch(
    `/api/horses/${encodeURIComponent(horseId)}/media/${encodeURIComponent(mediaId)}/file`,
    { method: "PATCH", body: fd }
  );
  const raw = await readApiData<unknown>(res);
  const item = normalizeHorseMedia(raw);
  if (!item) throw new ApiError("Invalid media replace response", { statusCode: 502 });
  return item;
}

export async function updateHorseMediaMeta(
  horseId: string,
  mediaId: string,
  payload: { caption?: string; sortOrder?: number }
): Promise<HorseMedia> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(horseId)}/media/${encodeURIComponent(mediaId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
  const raw = await readApiData<unknown>(res);
  const item = normalizeHorseMedia(raw);
  if (!item) throw new ApiError("Invalid media update response", { statusCode: 502 });
  return item;
}

export async function deleteHorseMedia(horseId: string, mediaId: string): Promise<void> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(horseId)}/media/${encodeURIComponent(mediaId)}`, {
    method: "DELETE",
  });
  await readApiData<unknown>(res);
}

export async function reorderHorseMedia(
  horseId: string,
  items: { id: string; sortOrder: number }[]
): Promise<void> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(horseId)}/media/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ items }),
    headers: { "Content-Type": "application/json" },
  });
  await readApiData<unknown>(res);
}

export async function fetchHorseAwards(horseId: string): Promise<HorseAward[]> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(horseId)}/awards`, { method: "GET" });
  const raw = await readApiData<unknown>(res);
  return unwrapListFromReadApi(raw)
    .map((x) => normalizeHorseAward(x))
    .filter((x): x is HorseAward => x !== null)
    .sort((a, b) => b.year - a.year);
}

export async function createHorseAward(
  horseId: string,
  payload: Omit<HorseAward, "id" | "createdAt" | "updatedAt">
): Promise<HorseAward> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(horseId)}/awards`, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
  const raw = await readApiData<unknown>(res);
  const item = normalizeHorseAward(raw);
  if (!item) throw new ApiError("Invalid award create response", { statusCode: 502 });
  return item;
}

export async function updateHorseAward(
  horseId: string,
  awardId: string,
  payload: Partial<Omit<HorseAward, "id" | "createdAt" | "updatedAt">>
): Promise<HorseAward> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(horseId)}/awards/${encodeURIComponent(awardId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
  const raw = await readApiData<unknown>(res);
  const item = normalizeHorseAward(raw);
  if (!item) throw new ApiError("Invalid award update response", { statusCode: 502 });
  return item;
}

export async function deleteHorseAward(horseId: string, awardId: string): Promise<void> {
  const res = await apiFetch(`/api/horses/${encodeURIComponent(horseId)}/awards/${encodeURIComponent(awardId)}`, {
    method: "DELETE",
  });
  await readApiData<unknown>(res);
}

