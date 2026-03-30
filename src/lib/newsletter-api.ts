import { apiFetch, readApiData } from "@/lib/api";

export type NewsletterSubscriber = {
  id?: string;
  email: string;
  fullName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

export function normalizeSubscriber(data: unknown): NewsletterSubscriber | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const email = pickString(o, ["email"]);
  if (!email) return null;
  return {
    id: pickString(o, ["id", "_id"]),
    email,
    fullName: pickString(o, ["fullName", "full_name", "name"]) ?? null,
    createdAt: pickString(o, ["createdAt", "created_at"]) ?? null,
    updatedAt: pickString(o, ["updatedAt", "updated_at"]) ?? null,
  };
}

export type NewsletterListResult = {
  rows: NewsletterSubscriber[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
};

/** Handles common API envelope shapes after `readApiData` unwrap. */
export function parseNewsletterListResponse(
  data: unknown,
  fallbackPage: number,
  fallbackLimit: number
): NewsletterListResult {
  let rows: NewsletterSubscriber[] = [];
  let total = 0;
  let page = fallbackPage;
  let limit = fallbackLimit;

  const pushList = (list: unknown[]) => {
    for (const item of list) {
      const n = normalizeSubscriber(item);
      if (n) rows.push(n);
    }
  };

  if (Array.isArray(data)) {
    pushList(data);
    total = rows.length;
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const list =
      o.items ??
      o.subscribers ??
      o.rows ??
      o.results ??
      (Array.isArray(o.data) ? o.data : undefined);
    if (Array.isArray(list)) pushList(list);

    const meta = o.meta as Record<string, unknown> | undefined;
    if (meta) {
      if (typeof meta.total === "number") total = meta.total;
      if (typeof meta.page === "number") page = meta.page;
      if (typeof meta.limit === "number") limit = meta.limit;
    }
    if (typeof o.total === "number") total = o.total;
    if (typeof o.page === "number") page = o.page;
    if (typeof o.limit === "number") limit = o.limit;
  }

  if (total === 0 && rows.length > 0) total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)) || 1);
  return { rows, total, page, totalPages, limit };
}

export async function fetchNewsletterPage(
  page: number,
  limit: number
): Promise<NewsletterListResult> {
  const res = await apiFetch(
    `/api/newsletter?page=${page}&limit=${limit}`,
    { method: "GET" }
  );
  const raw = await readApiData<unknown>(res);
  return parseNewsletterListResponse(raw, page, limit);
}

function normalizeExportRows(raw: unknown): NewsletterSubscriber[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => normalizeSubscriber(x))
      .filter((x): x is NewsletterSubscriber => x !== null);
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const inner = o.data ?? o.items ?? o.subscribers ?? o.rows;
    if (Array.isArray(inner)) {
      return inner
        .map((x) => normalizeSubscriber(x))
        .filter((x): x is NewsletterSubscriber => x !== null);
    }
  }
  return [];
}

export async function fetchNewsletterExport(): Promise<NewsletterSubscriber[]> {
  const res = await apiFetch("/api/newsletter/export", { method: "GET" });
  const raw = await readApiData<unknown>(res);
  return normalizeExportRows(raw);
}
