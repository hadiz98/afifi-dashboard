"use client";

import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export type PageLocale = "en" | "ar";
export type PageKey = "home" | "farm" | "about" | "news" | "events" | "horses" | "contact";
export type PageTitleColor = "black" | "white";

export type PageTranslation = {
  locale: PageLocale;
  title: string;
  titleColor?: PageTitleColor;
  subtitle?: string | null;
  text?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string | null;
};

export type PublicPageResponse = {
  key: PageKey;
  coverImage?: string | null;
  coverCrop?: unknown | null;
  isActive?: boolean;
  titleColor?: PageTitleColor;
  translation: Omit<PageTranslation, "locale">;
};

export type StaffPage = {
  key: PageKey;
  coverImage?: string | null;
  coverCrop?: unknown | null;
  isActive?: boolean;
  translations: Array<PageTranslation>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function parseTitleColor(v: unknown): PageTitleColor | undefined {
  if (v === "black" || v === "white") return v;
  return undefined;
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

export function normalizePageCoverImagePath(v: string): string {
  const value = v.trim();
  if (!value) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const base = apiBase();
  if (value.startsWith("/")) return base ? `${base}${value}` : value;
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("images/pages/")) {
    const prefixed = `/${normalized}`;
    return base ? `${base}${prefixed}` : prefixed;
  }
  const prefixed = `/images/pages/${normalized.split("/").pop() ?? normalized}`;
  return base ? `${base}${prefixed}` : prefixed;
}

function isPageKey(v: unknown): v is PageKey {
  return v === "home" || v === "farm" || v === "about" || v === "news" || v === "events" || v === "horses" || v === "contact";
}

function parseMaybeJson(raw: unknown): unknown | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return raw;
    }
  }
  return raw;
}

function unwrapList(raw: unknown): unknown[] {
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

function parseOptionalBoolean(v: unknown): boolean | undefined {
  if (v === true || v === 1 || v === "1" || v === "true") return true;
  if (v === false || v === 0 || v === "0" || v === "false") return false;
  return undefined;
}

/** Staff rows: keep partial locale payloads so the admin UI matches the backend. */
function normalizeStaffTranslation(raw: unknown, locale?: PageLocale): PageTranslation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const loc = (typeof o.locale === "string" ? o.locale : locale) as PageLocale | undefined;
  if (loc !== "en" && loc !== "ar") return null;
  const title = typeof o.title === "string" ? o.title : "";
  const text = typeof o.text === "string" ? o.text : null;
  const titleColor = parseTitleColor(o.titleColor ?? o.title_color);
  const subtitle = typeof o.subtitle === "string" ? o.subtitle : o.subtitle == null ? null : null;
  const metaDescription =
    typeof o.metaDescription === "string" ? o.metaDescription : o.metaDescription == null ? null : null;
  const metaKeywords =
    typeof o.metaKeywords === "string"
      ? o.metaKeywords
      : Array.isArray(o.metaKeywords)
        ? o.metaKeywords.map((v) => String(v).trim()).filter(Boolean).join(", ")
        : o.metaKeywords == null
          ? null
          : null;
  return { locale: loc, title, titleColor, text, subtitle, metaDescription, metaKeywords };
}

function translationsArrayFromRaw(translationsRaw: unknown): unknown[] {
  if (Array.isArray(translationsRaw)) return translationsRaw;
  if (!translationsRaw || typeof translationsRaw !== "object") return [];
  const o = translationsRaw as Record<string, unknown>;
  const out: unknown[] = [];
  for (const loc of ["en", "ar"] as const) {
    const chunk = o[loc];
    if (chunk && typeof chunk === "object") {
      out.push({ locale: loc, ...(chunk as Record<string, unknown>) });
    }
  }
  return out;
}

function normalizeStaffPage(raw: unknown): StaffPage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isPageKey(o.key)) return null;
  const coverImageRaw = typeof o.coverImage === "string" ? o.coverImage : o.coverImage == null ? null : null;
  const coverImage = coverImageRaw ? normalizePageCoverImagePath(coverImageRaw) : null;
  const coverCrop = parseMaybeJson(o.coverCrop);
  const isActive = parseOptionalBoolean(o.isActive);
  const translationsRaw = translationsArrayFromRaw(o.translations);
  const parsed = translationsRaw
    .map((x) => normalizeStaffTranslation(x))
    .filter((x): x is PageTranslation => x !== null);
  const byLocale = new Map<PageLocale, PageTranslation>();
  for (const tr of parsed) {
    byLocale.set(tr.locale, tr);
  }
  const translations = Array.from(byLocale.values());
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : null;
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : null;
  return { key: o.key, coverImage, coverCrop, isActive, translations, createdAt, updatedAt };
}

function normalizePublicPage(raw: unknown, key: PageKey): PublicPageResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const coverImageRaw = typeof o.coverImage === "string" ? o.coverImage : o.coverImage == null ? null : null;
  const coverImage = coverImageRaw ? normalizePageCoverImagePath(coverImageRaw) : null;
  const coverCrop = parseMaybeJson(o.coverCrop);
  const isActive = typeof o.isActive === "boolean" ? o.isActive : undefined;
  const titleColor = parseTitleColor(o.titleColor ?? o.title_color);
  const trRaw = o.translation;
  if (!trRaw || typeof trRaw !== "object") return null;
  const trObj = trRaw as Record<string, unknown>;
  const title = typeof trObj.title === "string" ? trObj.title : "";
  const text = typeof trObj.text === "string" ? trObj.text : null;
  if (!title.trim()) return null;
  const subtitle = typeof trObj.subtitle === "string" ? trObj.subtitle : trObj.subtitle == null ? null : null;
  const metaDescription =
    typeof trObj.metaDescription === "string" ? trObj.metaDescription : trObj.metaDescription == null ? null : null;
  const metaKeywords =
    typeof trObj.metaKeywords === "string"
      ? trObj.metaKeywords
      : Array.isArray(trObj.metaKeywords)
        ? trObj.metaKeywords.map((v) => String(v).trim()).filter(Boolean).join(", ")
        : trObj.metaKeywords == null
          ? null
          : null;
  return {
    key,
    coverImage,
    coverCrop,
    isActive,
    titleColor,
    translation: { title, text, subtitle, metaDescription, metaKeywords },
  };
}

export async function fetchPublicPage(params: { key: PageKey; locale: PageLocale }): Promise<PublicPageResponse> {
  const q = new URLSearchParams();
  q.set("locale", params.locale);
  const res = await apiFetch(`/api/public/pages/${encodeURIComponent(params.key)}?${q.toString()}`, {
    method: "GET",
    skipAuth: true,
  });
  const raw = await readApiData<unknown>(res);
  const page = normalizePublicPage(raw, params.key);
  if (!page) throw new ApiError("Invalid public page response", { statusCode: 502 });
  return page;
}

function tryNormalizeStaffPage(raw: unknown): StaffPage | null {
  return (
    normalizeStaffPage(raw) ??
    (raw && typeof raw === "object"
      ? normalizeStaffPage((raw as Record<string, unknown>).page)
      : null)
  );
}

export async function fetchPages(): Promise<StaffPage[]> {
  const res = await apiFetch("/api/pages", { method: "GET" });
  const raw = await readApiData<unknown>(res);
  return unwrapList(raw)
    .map((x) => tryNormalizeStaffPage(x))
    .filter((x): x is StaffPage => x !== null);
}

export async function fetchPageByKey(key: PageKey): Promise<StaffPage> {
  const res = await apiFetch(`/api/pages/${encodeURIComponent(key)}`, { method: "GET" });
  const raw = await readApiData<unknown>(res);
  const item = tryNormalizeStaffPage(raw);
  if (!item) throw new ApiError("Invalid page response", { statusCode: 502 });
  return item;
}

export async function upsertPage(params: {
  key: PageKey;
  isActive?: boolean;
  coverCropJson?: string;
  translationsJson?: string;
  coverFile?: File | null;
}): Promise<StaffPage> {
  const fd = new FormData();
  if (typeof params.isActive === "boolean") fd.append("isActive", params.isActive ? "1" : "0");
  if (typeof params.coverCropJson === "string") fd.append("coverCrop", params.coverCropJson);
  if (typeof params.translationsJson === "string") fd.append("translations", params.translationsJson);
  if (params.coverFile) fd.append("coverImage", params.coverFile);
  const res = await apiFetch(`/api/pages/${encodeURIComponent(params.key)}`, { method: "PUT", body: fd });
  const raw = await readApiData<unknown>(res);
  const item = tryNormalizeStaffPage(raw);
  if (!item) throw new ApiError("Invalid page upsert response", { statusCode: 502 });
  return item;
}

export async function deletePage(key: PageKey): Promise<void> {
  const res = await apiFetch(`/api/pages/${encodeURIComponent(key)}`, { method: "DELETE" });
  await readApiData<unknown>(res);
}

/** Removes the page cover image (and related crop on the server, if applicable). */
export async function deletePageCover(key: PageKey): Promise<StaffPage> {
  const res = await apiFetch(`/api/pages/${encodeURIComponent(key)}/cover`, {
    method: "DELETE",
  });
  const raw = await readApiData<unknown>(res);
  const fromBody = tryNormalizeStaffPage(raw);
  if (fromBody) return fromBody;
  return fetchPageByKey(key);
}

