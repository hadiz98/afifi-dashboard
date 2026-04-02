"use client";

import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export type EventLocale = "en" | "ar";

export type EventTranslation = {
  locale: EventLocale;
  title: string;
  subtitle: string;
  fullContent?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export type EventAdminListItem = {
  id: string;
  slug: string;
  startsAt: string;
  endsAt?: string | null;
  image?: string | null;
  isActive?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  translations: EventTranslation[];
};

export type EventDetails = EventAdminListItem;

export type PublicEventListItem = {
  slug: string;
  startsAt: string;
  endsAt?: string | null;
  image?: string | null;
  translation: { locale: EventLocale; title: string; subtitle: string } | null;
};

export type PublicEventDetails = {
  slug: string;
  startsAt: string;
  endsAt?: string | null;
  image?: string | null;
  isActive?: boolean;
  translation:
    | {
        locale: EventLocale;
        title: string;
        subtitle: string;
        fullContent: string;
        metaTitle?: string | null;
        metaDescription?: string | null;
      }
    | null;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

export function normalizeEventImagePath(v: string): string {
  const value = v.trim();
  if (!value) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const base = apiBase();
  if (value.startsWith("/")) return base ? `${base}${value}` : value;
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("images/events/")) {
    const prefixed = `/${normalized}`;
    return base ? `${base}${prefixed}` : prefixed;
  }
  const prefixed = `/images/events/${normalized.split("/").pop() ?? normalized}`;
  return base ? `${base}${prefixed}` : prefixed;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function pickNullableString(obj: Record<string, unknown>, keys: string[]): string | null | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v === null) return null;
    if (typeof v === "string") return v;
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

function normalizeLocale(v: unknown): EventLocale | null {
  if (typeof v !== "string") return null;
  const s = v.toLowerCase();
  if (s === "en" || s === "ar") return s;
  return null;
}

function normalizeTranslation(data: unknown): EventTranslation | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const locale = normalizeLocale(pickString(o, ["locale"]));
  if (!locale) return null;
  const title = pickString(o, ["title"]);
  if (!title) return null;
  const fullFromApi = pickNullableString(o, ["fullContent", "full_content"]);
  const legacyDesc = pickNullableString(o, ["description"]);
  const fullContent =
    typeof fullFromApi === "string"
      ? fullFromApi
      : fullFromApi === null
        ? null
        : typeof legacyDesc === "string"
          ? legacyDesc
          : legacyDesc === null
            ? null
            : null;
  const metaTitle = pickNullableString(o, ["metaTitle", "meta_title"]);
  const metaDescription = pickNullableString(o, ["metaDescription", "meta_description"]);
  return {
    locale,
    title,
    subtitle: pickString(o, ["subtitle"]) ?? (typeof o.subtitle === "string" ? o.subtitle : ""),
    fullContent,
    metaTitle: metaTitle === undefined ? undefined : metaTitle,
    metaDescription: metaDescription === undefined ? undefined : metaDescription,
  };
}

export function pickBestTranslation(
  item: { translations: EventTranslation[] },
  locale: string
): EventTranslation | null {
  const want: EventLocale = locale === "ar" ? "ar" : "en";
  const exact = item.translations.find((t) => t.locale === want);
  const fallback = item.translations.find((t) => t.locale === "en") ?? item.translations[0];
  return exact ?? fallback ?? null;
}

export function normalizeEventAdminListItem(data: unknown): EventAdminListItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = pickString(o, ["id", "_id"]) ?? (typeof o.id !== "undefined" ? String(o.id) : undefined);
  const slug = pickString(o, ["slug"]);
  const startsAt = pickString(o, ["startsAt", "starts_at"]);
  if (!id || !slug || !startsAt) return null;
  const translationsRaw = o.translations;
  const translations = Array.isArray(translationsRaw)
    ? translationsRaw.map(normalizeTranslation).filter((x): x is EventTranslation => x !== null)
    : [];
  const imageRaw = pickString(o, ["image"]);
  return {
    id,
    slug,
    startsAt,
    endsAt: pickString(o, ["endsAt", "ends_at"]) ?? null,
    image: imageRaw ? normalizeEventImagePath(imageRaw) : null,
    isActive: pickBoolean(o, ["isActive", "is_active"]) ?? undefined,
    createdAt: pickString(o, ["createdAt", "created_at"]) ?? null,
    updatedAt: pickString(o, ["updatedAt", "updated_at"]) ?? null,
    deletedAt: pickString(o, ["deletedAt", "deleted_at"]) ?? null,
    translations,
  };
}

export type EventsPageResult = {
  rows: EventAdminListItem[];
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

export async function fetchEventsPage(params?: { page?: number; limit?: number }): Promise<EventsPageResult> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const res = await apiFetch(`/api/events?page=${page}&limit=${limit}`, { method: "GET" });
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
    ? list.map(normalizeEventAdminListItem).filter((x): x is EventAdminListItem => x !== null)
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

export async function fetchEventById(id: string): Promise<EventDetails> {
  const res = await apiFetch(`/api/events/${encodeURIComponent(id)}`, { method: "GET" });
  const raw = await readApiData<unknown>(res);
  const item = normalizeEventAdminListItem(raw);
  if (!item) throw new ApiError("Invalid event response", { statusCode: 502 });
  return item;
}

export async function createEvent(form: FormData): Promise<EventDetails> {
  const res = await apiFetch("/api/events", { method: "POST", body: form });
  const raw = await readApiData<unknown>(res);
  const item = normalizeEventAdminListItem(raw);
  if (!item) throw new ApiError("Invalid event create response", { statusCode: 502 });
  return item;
}

export async function updateEvent(id: string, form: FormData): Promise<EventDetails> {
  const res = await apiFetch(`/api/events/${encodeURIComponent(id)}`, { method: "PATCH", body: form });
  const raw = await readApiData<unknown>(res);
  const item = normalizeEventAdminListItem(raw);
  if (!item) throw new ApiError("Invalid event update response", { statusCode: 502 });
  return item;
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await apiFetch(`/api/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  await readApiData<unknown>(res);
}

export async function deleteEventImage(id: string): Promise<void> {
  const res = await apiFetch(`/api/events/${encodeURIComponent(id)}/image`, { method: "DELETE" });
  await readApiData<unknown>(res);
}

function normalizePublicEventListItem(data: unknown, locale: EventLocale): PublicEventListItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const slug = pickString(o, ["slug"]);
  const startsAt = pickString(o, ["startsAt", "starts_at"]);
  if (!slug || !startsAt) return null;
  const imageRaw = pickString(o, ["image"]);
  const trObj =
    (o.translation && typeof o.translation === "object" ? (o.translation as Record<string, unknown>) : null) ??
    null;
  const translation = trObj
    ? {
        locale,
        title: pickString(trObj, ["title"]) ?? "",
        subtitle: pickString(trObj, ["subtitle"]) ?? "",
      }
    : null;
  return {
    slug,
    startsAt,
    endsAt: pickString(o, ["endsAt", "ends_at"]) ?? null,
    image: imageRaw ? normalizeEventImagePath(imageRaw) : null,
    translation,
  };
}

function normalizePublicEventDetails(data: unknown, locale: EventLocale): PublicEventDetails | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const slug = pickString(o, ["slug"]);
  const startsAt = pickString(o, ["startsAt", "starts_at"]);
  if (!slug || !startsAt) return null;
  const imageRaw = pickString(o, ["image"]);
  const trObj =
    (o.translation && typeof o.translation === "object" ? (o.translation as Record<string, unknown>) : null) ??
    null;
  const translation = trObj
    ? {
        locale,
        title: pickString(trObj, ["title"]) ?? "",
        subtitle: pickString(trObj, ["subtitle"]) ?? "",
        fullContent:
          pickNullableString(trObj, ["fullContent", "full_content"]) ??
          pickNullableString(trObj, ["description"]) ??
          "",
        metaTitle: pickNullableString(trObj, ["metaTitle", "meta_title"]),
        metaDescription: pickNullableString(trObj, ["metaDescription", "meta_description"]),
      }
    : null;
  return {
    slug,
    startsAt,
    endsAt: pickString(o, ["endsAt", "ends_at"]) ?? null,
    image: imageRaw ? normalizeEventImagePath(imageRaw) : null,
    isActive: pickBoolean(o, ["isActive", "is_active"]) ?? undefined,
    translation,
  };
}

export async function fetchPublicEventsPage(params: {
  locale: EventLocale;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  activeOnly?: boolean;
}): Promise<{ rows: PublicEventListItem[]; meta: { total: number; page: number; limit: number; pages: number } }> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const q = new URLSearchParams();
  q.set("locale", params.locale);
  q.set("page", String(page));
  q.set("limit", String(limit));
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (typeof params.activeOnly === "boolean") q.set("activeOnly", params.activeOnly ? "true" : "false");

  const res = await apiFetch(`/api/public/events?${q.toString()}`, { method: "GET", skipAuth: true });
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
        .map((x) => normalizePublicEventListItem(x, params.locale))
        .filter((x): x is PublicEventListItem => x !== null)
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

export async function fetchPublicEventBySlug(params: {
  slug: string;
  locale: EventLocale;
}): Promise<PublicEventDetails> {
  const q = new URLSearchParams();
  q.set("locale", params.locale);
  const res = await apiFetch(`/api/public/events/${encodeURIComponent(params.slug)}?${q.toString()}`, {
    method: "GET",
    skipAuth: true,
  });
  const raw = await readApiData<unknown>(res);
  const item = normalizePublicEventDetails(raw, params.locale);
  if (!item) throw new ApiError("Invalid public event response", { statusCode: 502 });
  return item;
}

