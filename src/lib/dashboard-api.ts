import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { BRAND_MEDIA } from "@/lib/media-paths";
import { normalizeEventImagePath, type EventLocale } from "@/lib/events-api";
import { normalizeHorseCoverImagePath } from "@/lib/horses-api";

export type DashboardLocale = EventLocale;

export type DashboardNewsRecentItem = {
  id: string;
  date?: string | null;
  isActive?: boolean;
  image?: string | null;
  translations: Array<{ locale: DashboardLocale; title: string; subtitle: string }>;
};

export type DashboardHorseRecentItem = {
  id: string;
  slug: string;
  category: "stallion" | "mare" | "filly" | "colt";
  isActive?: boolean;
  coverImage?: string | null;
  updatedAt?: string | null;
};

export type DashboardUpcomingEventItem = {
  id: string;
  slug: string;
  startsAt: string;
  endsAt?: string | null;
  isActive?: boolean;
  image?: string | null;
  translation: { locale: DashboardLocale; title: string; subtitle: string } | null;
};

export type DashboardSubscriberRecentItem = {
  id: string;
  email: string;
  fullName?: string | null;
  createdAt?: string | null;
};

export type DashboardSummary = {
  news: {
    total: number;
    active: number;
    inactive: number;
    recent: DashboardNewsRecentItem[];
  };
  horses: {
    total: number;
    active: number;
    inactive: number;
    byCategory: { stallion: number; mare: number; filly: number; colt: number };
    recent: DashboardHorseRecentItem[];
  };
  events: {
    total: number;
    active: number;
    inactive: number;
    upcoming: number;
    today: number;
    upcomingList: DashboardUpcomingEventItem[];
  };
  newsletter: {
    total: number;
    recent: DashboardSubscriberRecentItem[];
  };
};

function pickString(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  return typeof v === "string" ? v : null;
}

function pickNumber(o: Record<string, unknown>, key: string, fallback = 0): number {
  const v = o[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function pickBoolean(o: Record<string, unknown>, key: string): boolean | undefined {
  const v = o[key];
  return typeof v === "boolean" ? v : undefined;
}

function normalizeNewsImagePath(image: string): string {
  const v = image.trim();
  if (!v) return v;
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (v.startsWith("/")) return apiBase ? `${apiBase}${v}` : v;
  const normalized = v.replace(/\\/g, "/");
  if (normalized.startsWith("images/news/")) {
    const prefixed = `/${normalized}`;
    return apiBase ? `${apiBase}${prefixed}` : prefixed;
  }
  const base = BRAND_MEDIA.newsImageBase.endsWith("/")
    ? BRAND_MEDIA.newsImageBase
    : `${BRAND_MEDIA.newsImageBase}/`;
  const filename = normalized.split("/").pop() ?? normalized;
  const relative = `${base}${filename}`;
  return apiBase ? `${apiBase}${relative}` : relative;
}

function normalizeNewsRecentItem(data: unknown): DashboardNewsRecentItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = pickString(o, "id");
  if (!id) return null;
  const rawTranslations = Array.isArray(o.translations) ? o.translations : [];
  const translations = rawTranslations
    .map((t): { locale: DashboardLocale; title: string; subtitle: string } | null => {
      if (!t || typeof t !== "object") return null;
      const tr = t as Record<string, unknown>;
      const locale = (pickString(tr, "locale") ?? "").toLowerCase() as DashboardLocale;
      if (locale !== "en" && locale !== "ar") return null;
      const title = pickString(tr, "title");
      if (!title) return null;
      return { locale, title, subtitle: pickString(tr, "subtitle") ?? "" };
    })
    .filter((x): x is { locale: DashboardLocale; title: string; subtitle: string } => x !== null);

  const imageRaw = pickString(o, "image");
  return {
    id,
    date: pickString(o, "date"),
    isActive: pickBoolean(o, "isActive"),
    image: imageRaw ? normalizeNewsImagePath(imageRaw) : null,
    translations,
  };
}

function normalizeHorseRecentItem(data: unknown): DashboardHorseRecentItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = pickString(o, "id");
  const slug = pickString(o, "slug");
  const category = pickString(o, "category");
  if (!id || !slug) return null;
  if (category !== "stallion" && category !== "mare" && category !== "filly" && category !== "colt") {
    return null;
  }
  const coverRaw = pickString(o, "coverImage");
  return {
    id,
    slug,
    category,
    isActive: pickBoolean(o, "isActive"),
    coverImage: coverRaw ? normalizeHorseCoverImagePath(coverRaw) : null,
    updatedAt: pickString(o, "updatedAt"),
  };
}

function normalizeUpcomingEventItem(data: unknown): DashboardUpcomingEventItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = pickString(o, "id");
  const slug = pickString(o, "slug");
  const startsAt = pickString(o, "startsAt");
  if (!id || !slug || !startsAt) return null;
  const imageRaw = pickString(o, "image");
  const trObj = o.translation && typeof o.translation === "object" ? (o.translation as Record<string, unknown>) : null;
  const translation = trObj
    ? {
        locale: ((pickString(trObj, "locale") ?? "").toLowerCase() as DashboardLocale) || "en",
        title: pickString(trObj, "title") ?? "",
        subtitle: pickString(trObj, "subtitle") ?? "",
      }
    : null;
  return {
    id,
    slug,
    startsAt,
    endsAt: pickString(o, "endsAt"),
    isActive: pickBoolean(o, "isActive"),
    image: imageRaw ? normalizeEventImagePath(imageRaw) : null,
    translation,
  };
}

function normalizeSubscriberRecentItem(data: unknown): DashboardSubscriberRecentItem | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const id = pickString(o, "id");
  const email = pickString(o, "email");
  if (!id || !email) return null;
  return {
    id,
    email,
    fullName: pickString(o, "fullName"),
    createdAt: pickString(o, "createdAt"),
  };
}

function normalizeSummary(data: unknown): DashboardSummary | null {
  if (!data || typeof data !== "object") return null;
  const root = data as Record<string, unknown>;
  const newsObj = root.news && typeof root.news === "object" ? (root.news as Record<string, unknown>) : null;
  const horsesObj = root.horses && typeof root.horses === "object" ? (root.horses as Record<string, unknown>) : null;
  const eventsObj = root.events && typeof root.events === "object" ? (root.events as Record<string, unknown>) : null;
  const newsletterObj = root.newsletter && typeof root.newsletter === "object" ? (root.newsletter as Record<string, unknown>) : null;
  if (!newsObj || !horsesObj || !eventsObj || !newsletterObj) return null;

  const byCategoryObj =
    horsesObj.byCategory && typeof horsesObj.byCategory === "object"
      ? (horsesObj.byCategory as Record<string, unknown>)
      : {};

  const newsRecent = Array.isArray(newsObj.recent)
    ? newsObj.recent.map(normalizeNewsRecentItem).filter((x): x is DashboardNewsRecentItem => x !== null)
    : [];
  const horsesRecent = Array.isArray(horsesObj.recent)
    ? horsesObj.recent.map(normalizeHorseRecentItem).filter((x): x is DashboardHorseRecentItem => x !== null)
    : [];
  const upcomingList = Array.isArray(eventsObj.upcomingList)
    ? eventsObj.upcomingList.map(normalizeUpcomingEventItem).filter((x): x is DashboardUpcomingEventItem => x !== null)
    : [];
  const newsletterRecent = Array.isArray(newsletterObj.recent)
    ? newsletterObj.recent.map(normalizeSubscriberRecentItem).filter((x): x is DashboardSubscriberRecentItem => x !== null)
    : [];

  return {
    news: {
      total: pickNumber(newsObj, "total", newsRecent.length),
      active: pickNumber(newsObj, "active", 0),
      inactive: pickNumber(newsObj, "inactive", 0),
      recent: newsRecent,
    },
    horses: {
      total: pickNumber(horsesObj, "total", horsesRecent.length),
      active: pickNumber(horsesObj, "active", 0),
      inactive: pickNumber(horsesObj, "inactive", 0),
      byCategory: {
        stallion: pickNumber(byCategoryObj, "stallion", 0),
        mare: pickNumber(byCategoryObj, "mare", 0),
        filly: pickNumber(byCategoryObj, "filly", 0),
        colt: pickNumber(byCategoryObj, "colt", 0),
      },
      recent: horsesRecent,
    },
    events: {
      total: pickNumber(eventsObj, "total", upcomingList.length),
      active: pickNumber(eventsObj, "active", 0),
      inactive: pickNumber(eventsObj, "inactive", 0),
      upcoming: pickNumber(eventsObj, "upcoming", 0),
      today: pickNumber(eventsObj, "today", 0),
      upcomingList,
    },
    newsletter: {
      total: pickNumber(newsletterObj, "total", newsletterRecent.length),
      recent: newsletterRecent,
    },
  };
}

export async function fetchDashboardSummary(locale: DashboardLocale): Promise<DashboardSummary> {
  const res = await apiFetch(`/api/dashboard/summary?locale=${encodeURIComponent(locale)}`, { method: "GET" });
  const raw = await readApiData<unknown>(res);
  const normalized = normalizeSummary(raw);
  if (!normalized) throw new ApiError("Invalid dashboard summary response", { statusCode: 502 });
  return normalized;
}

