"use client";

import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export type GalleryItem = {
  id: string;
  url: string;
  instagramLink?: string | null;
  crops?: string | null;
  sortOrder?: number | null;
  createdAt?: string | null;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
}

export function normalizeGalleryImagePath(v: string): string {
  const value = v.trim();
  if (!value) return value;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const base = apiBase();
  if (value.startsWith("/")) return base ? `${base}${value}` : value;
  const normalized = value.replace(/\\/g, "/");
  if (normalized.startsWith("images/gallery/")) {
    const prefixed = `/${normalized}`;
    return base ? `${base}${prefixed}` : prefixed;
  }
  const prefixed = `/images/gallery/${normalized.split("/").pop() ?? normalized}`;
  return base ? `${base}${prefixed}` : prefixed;
}

function normalizeGalleryItem(raw: unknown): GalleryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  if (!id) return null;
  const urlRaw =
    (typeof o.url === "string" ? o.url : null) ??
    (typeof o.image === "string" ? o.image : null) ??
    (typeof o.path === "string" ? o.path : null);
  const url = urlRaw ? normalizeGalleryImagePath(urlRaw) : "";
  if (!url) return null;
  const instagramLink =
    typeof o.instagramLink === "string" ? o.instagramLink : o.instagramLink == null ? null : null;
  const crops = typeof o.crops === "string" ? o.crops : o.crops == null ? null : null;
  const sortOrder = typeof o.sortOrder === "number" ? o.sortOrder : null;
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : null;
  return { id, url, instagramLink, crops, sortOrder, createdAt };
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

export async function fetchGallery(): Promise<GalleryItem[]> {
  const res = await apiFetch("/api/gallery", { method: "GET" });
  const raw = await readApiData<unknown>(res);
  return unwrapList(raw)
    .map((x) => normalizeGalleryItem(x))
    .filter((x): x is GalleryItem => x !== null)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function uploadGalleryImages(params: {
  files: File[];
  instagramLink?: string;
  sortOrderBase?: number;
}): Promise<GalleryItem[]> {
  if (!params.files.length) {
    throw new ApiError("At least one image file is required", { statusCode: 400 });
  }
  const fd = new FormData();
  for (const f of params.files) fd.append("files", f);
  if (params.instagramLink?.trim()) fd.append("instagramLink", params.instagramLink.trim());
  if (typeof params.sortOrderBase === "number" && Number.isFinite(params.sortOrderBase)) {
    fd.append("sortOrderBase", String(params.sortOrderBase));
  }
  const res = await apiFetch("/api/gallery", { method: "POST", body: fd });
  const raw = await readApiData<unknown>(res);
  return unwrapList(raw)
    .map((x) => normalizeGalleryItem(x))
    .filter((x): x is GalleryItem => x !== null);
}

export async function updateGalleryMeta(
  id: string,
  patch: { instagramLink?: string; crops?: string; sortOrder?: number }
): Promise<GalleryItem> {
  const body: Record<string, unknown> = {};
  if (patch.instagramLink !== undefined) body.instagramLink = patch.instagramLink;
  if (patch.crops !== undefined) body.crops = patch.crops;
  if (patch.sortOrder !== undefined) body.sortOrder = patch.sortOrder;
  const res = await apiFetch(`/api/gallery/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const raw = await readApiData<unknown>(res);
  const item = normalizeGalleryItem(raw);
  if (!item) throw new ApiError("Invalid gallery update response", { statusCode: 502 });
  return item;
}

export async function deleteGalleryImage(id: string): Promise<void> {
  const res = await apiFetch(`/api/gallery/${encodeURIComponent(id)}`, { method: "DELETE" });
  await readApiData<unknown>(res);
}

