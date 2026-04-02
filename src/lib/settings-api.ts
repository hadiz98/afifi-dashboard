"use client";

import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export type SettingsLocale = "en" | "ar";

export type LocalizedText = Partial<Record<SettingsLocale, string>>;

export type SiteSettings = {
  id: string;
  websiteName?: LocalizedText | null;
  instagramLink?: string | null;
  youtubeLink?: string | null;
  facebookLink?: string | null;
  contactEmail?: string | null;
  address?: LocalizedText | null;
  phoneNumber?: string | null;
  visitingHours?: LocalizedText | null;
  whatsappNumber?: string | null;
  footerText?: LocalizedText | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SettingsUpsertPayload = Partial<{
  websiteName: LocalizedText;
  instagramLink: string;
  youtubeLink: string;
  facebookLink: string;
  contactEmail: string;
  address: LocalizedText;
  phoneNumber: string;
  visitingHours: LocalizedText;
  whatsappNumber: string;
  footerText: LocalizedText;
}>;

function pickLocalized(obj: Record<string, unknown>, key: string): LocalizedText | null {
  const raw = obj[key];
  if (raw == null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: LocalizedText = {};
  if (typeof o.en === "string") out.en = o.en;
  if (typeof o.ar === "string") out.ar = o.ar;
  return Object.keys(out).length ? out : {};
}

function normalizeSettings(raw: unknown): SiteSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  if (!id) return null;
  const s = (v: unknown): string | null =>
    typeof v === "string" ? v : v == null ? null : null;
  const n = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  void n; // reserved for future numeric fields

  return {
    id,
    websiteName: pickLocalized(o, "websiteName"),
    instagramLink: s(o.instagramLink),
    youtubeLink: s(o.youtubeLink),
    facebookLink: s(o.facebookLink),
    contactEmail: s(o.contactEmail),
    address: pickLocalized(o, "address"),
    phoneNumber: s(o.phoneNumber),
    visitingHours: pickLocalized(o, "visitingHours"),
    whatsappNumber: s(o.whatsappNumber),
    footerText: pickLocalized(o, "footerText"),
    createdAt: s(o.createdAt),
    updatedAt: s(o.updatedAt),
  };
}

export async function fetchPublicSettings(): Promise<SiteSettings | null> {
  const res = await apiFetch("/api/public/settings", { method: "GET", skipAuth: true });
  const raw = await readApiData<unknown>(res);
  if (raw == null) return null;
  const item = normalizeSettings(raw);
  if (!item) throw new ApiError("Invalid settings response", { statusCode: 502 });
  return item;
}

export async function upsertSettings(patch: SettingsUpsertPayload): Promise<SiteSettings> {
  const res = await apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(patch) });
  const raw = await readApiData<unknown>(res);
  const item = normalizeSettings(raw);
  if (!item) throw new ApiError("Invalid settings upsert response", { statusCode: 502 });
  return item;
}

