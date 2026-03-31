import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { BRAND_MEDIA } from "@/lib/media-paths";

export type NewsLocale = "en" | "ar";

export type NewsTranslation = {
  locale: NewsLocale;
  title: string;
  subtitle: string;
  description?: string | null;
  tags?: string[] | null;
  subDescription?: string | null;
};

export type NewsItem = {
  id: string;
  translations: NewsTranslation[];
  image?: string | null;
  date?: string | null;
  createdAt?: string | null;
  isActive?: boolean;
};

function normalizeNewsImagePath(image: string): string {
  const v = image.trim();
  if (!v) return v;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  // Backend returns paths like "/images/news/<filename>".
  if (v.startsWith("/")) {
    // If apiBase is missing, fall back to the raw path.
    return apiBase ? `${apiBase}${v}` : v;
  }

  // Backend may return:
  // - just "foo.png"
  // - "images/news/foo.png"
  // - "images\\news\\foo.png"
  const normalized = v.replace(/\\/g, "/");
  if (normalized.startsWith("images/news/")) {
    const prefixed = `/${normalized}`;
    return apiBase ? `${apiBase}${prefixed}` : prefixed;
  }

  // Treat everything else as a filename.
  const base = BRAND_MEDIA.newsImageBase.endsWith("/")
    ? BRAND_MEDIA.newsImageBase
    : `${BRAND_MEDIA.newsImageBase}/`;
  const filename = normalized.split("/").pop() ?? normalized;
  const relative = `${base}${filename}`;
  return apiBase ? `${apiBase}${relative}` : relative;
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
      if (v === "true") return true;
      if (v === "false") return false;
    }
  }
  return undefined;
}

function pickTags(obj: Record<string, unknown>): string[] | undefined {
  const v = obj.tags;
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  if (v === null) {
    return [];
  }
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === "string" && x.length > 0);
      }
    } catch {
      // fall through
    }
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

function normalizeTranslation(data: unknown): NewsTranslation | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const localeRaw = pickString(o, ["locale"]);
  const locale = (localeRaw?.toLowerCase() as NewsLocale | undefined) ?? undefined;
  if (locale !== "en" && locale !== "ar") return null;
  const title = pickString(o, ["title"]);
  if (!title) return null;
  const description = pickString(o, ["description"]) ?? null;
  const tags = pickTags(o) ?? null;
  return {
    locale,
    title,
    subtitle: pickString(o, ["subtitle"]) ?? "",
    description,
    tags,
    subDescription: pickString(o, ["subDescription", "sub_description"]) ?? null,
  };
}

export function pickBestTranslation(item: NewsItem, locale: string): NewsTranslation | null {
  const want: NewsLocale = locale === "ar" ? "ar" : "en";
  const list = item.translations ?? [];
  const exact = list.find((t) => t.locale === want);
  if (exact) return exact;
  const fallback = list.find((t) => t.locale === "en") ?? list[0];
  return fallback ?? null;
}

export function normalizeNewsItem(data: unknown): NewsItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const id =
    pickString(o, ["id", "_id", "newsId", "news_id"]) ??
    (typeof o.id !== "undefined" ? String(o.id) : undefined);

  if (!id) return null;

  return {
    id,
    translations: (() => {
      const raw = o.translations;
      if (Array.isArray(raw)) {
        return raw
          .map((x) => normalizeTranslation(x))
          .filter((x): x is NewsTranslation => x !== null);
      }
      // Support legacy map form: { en: {...}, ar: {...} }
      if (raw && typeof raw === "object") {
        const map = raw as Record<string, unknown>;
        const out: NewsTranslation[] = [];
        for (const loc of ["en", "ar"] as const) {
          const entry = map[loc];
          if (entry && typeof entry === "object") {
            const merged = { ...(entry as Record<string, unknown>), locale: loc };
            const n = normalizeTranslation(merged);
            if (n) out.push(n);
          }
        }
        return out;
      }
      return [];
    })(),
    image: (() => {
      const img = pickString(o, ["image", "img"]);
      return img ? normalizeNewsImagePath(img) : null;
    })(),
    date: pickString(o, ["date", "createdAt", "created_at"]) ?? null,
    createdAt: pickString(o, ["createdAt", "created_at"]) ?? null,
    isActive: pickBoolean(o, ["isActive", "is_active"]) ?? undefined,
  };
}

export async function fetchNewsList(params?: {
  page?: number;
  limit?: number;
}): Promise<unknown> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const res = await apiFetch(`/api/news?page=${page}&limit=${limit}`, { method: "GET" });
  return readApiData<unknown>(res);
}

export type NewsListMeta = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type NewsListPage = {
  rows: NewsItem[];
  meta: NewsListMeta;
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

/**
 * Backend list response: { data: News[], meta: { total, page, limit, pages } }
 * We parse the full envelope so UI can paginate.
 */
export async function fetchNewsListPage(params?: {
  page?: number;
  limit?: number;
}): Promise<NewsListPage> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const res = await apiFetch(`/api/news?page=${page}&limit=${limit}`, { method: "GET" });
  const body = await parseJson(res);
  if (!res.ok) {
    throw ApiError.fromBody(body, res.status);
  }
  if (!body || typeof body !== "object") {
    return { rows: [], meta: { total: 0, page, limit, pages: 1 } };
  }
  const record = body as Record<string, unknown>;
  if (record.success === false) {
    throw ApiError.fromBody(body, res.status);
  }
  // Backend may return either:
  //  A) { data: News[], meta: {...} }
  //  B) { data: { data: News[], meta: {...} } }
  const outerData = record.data;
  const inner =
    outerData && typeof outerData === "object"
      ? (outerData as Record<string, unknown>)
      : null;

  const list =
    (inner && Array.isArray(inner.data) ? inner.data : null) ??
    (Array.isArray(outerData) ? outerData : null);

  const meta =
    (inner?.meta as Record<string, unknown> | undefined) ??
    (record.meta as Record<string, unknown> | undefined);
  const rows = Array.isArray(list)
    ? list.map((x) => normalizeNewsItem(x)).filter((x): x is NewsItem => x !== null)
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

export async function fetchNewsById(id: string): Promise<NewsItem> {
  const res = await apiFetch(`/api/news/${encodeURIComponent(id)}`, {
    method: "GET",
  });
  const raw = await readApiData<unknown>(res);
  const item = normalizeNewsItem(raw);
  if (!item) {
    throw new ApiError("Invalid news response", { statusCode: 502 });
  }
  return item;
}

export async function createNews(form: FormData): Promise<NewsItem> {
  const res = await apiFetch("/api/news", {
    method: "POST",
    body: form,
  });
  const raw = await readApiData<unknown>(res);
  const item = normalizeNewsItem(raw);
  if (!item) {
    throw new ApiError("Invalid news create response", { statusCode: 502 });
  }
  return item;
}

export async function updateNews(id: string, form: FormData): Promise<NewsItem> {
  const res = await apiFetch(`/api/news/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: form,
  });
  const raw = await readApiData<unknown>(res);
  const item = normalizeNewsItem(raw);
  if (!item) {
    throw new ApiError("Invalid news update response", { statusCode: 502 });
  }
  return item;
}

export async function deleteNews(id: string): Promise<void> {
  const res = await apiFetch(`/api/news/${encodeURIComponent(id)}`, { method: "DELETE" });
  await readApiData<unknown>(res);
}

export async function deleteNewsImage(id: string): Promise<void> {
  const res = await apiFetch(`/api/news/${encodeURIComponent(id)}/image`, { method: "DELETE" });
  await readApiData<unknown>(res);
}

