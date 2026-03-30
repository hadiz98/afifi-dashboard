import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { BRAND_MEDIA } from "@/lib/media-paths";

export type NewsItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  subDescription?: string | null;
  tags?: string[] | null;
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
  if (typeof v === "string") {
    // backend can accept comma-separated tags; normalize similarly.
    return v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export function normalizeNewsItem(data: unknown): NewsItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const id =
    pickString(o, ["id", "_id", "newsId", "news_id"]) ??
    (typeof o.id !== "undefined" ? String(o.id) : undefined);

  const title = pickString(o, ["title"]);
  if (!id || !title) return null;

  return {
    id,
    title,
    subtitle: pickString(o, ["subtitle"]) ?? null,
    description: pickString(o, ["description"]) ?? null,
    subDescription: pickString(o, ["subDescription", "sub_description"]) ?? null,
    tags: pickTags(o) ?? null,
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

