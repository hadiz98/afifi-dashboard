"use client";

import * as tus from "tus-js-client";

import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";

export type Video = {
  id: string;
  bunnyVideoGuid: string;
  title: string;
  description: string | null;
  titleTranslations?: Record<string, string> | null;
  descriptionTranslations?: Record<string, string> | null;
  bunnyStatus: number | null;
  hlsUrl: string | null;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  embedUrl: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TusCredentials = {
  libraryId: string;
  videoId: string;
  authorizationExpire: number;
  authorizationSignature: string;
  tusEndpoint: string;
};

export type UploadSessionResponse = {
  video: Video;
  tus: TusCredentials;
  tusMetadata: Record<string, string | number>;
  embedUrl: string;
};

export type CreateUploadSessionInput = {
  title: string;
  description?: string;
  titleTranslations?: Record<string, string>;
  descriptionTranslations?: Record<string, string>;
  filetype?: string;
  tusTitle?: string;
  thumbnailTime?: number;
};

export type UpdateVideoInput = {
  title?: string;
  description?: string | null;
  titleTranslations?: Record<string, string> | null;
  descriptionTranslations?: Record<string, string> | null;
  isActive?: boolean;
  sortOrder?: number;
};

/**
 * Bunny Stream `VideoModelStatus` mapping (subset used in UI).
 * @see https://docs.bunny.net/api-reference/stream/manage-videos/get-video
 */
export const BUNNY_STATUS = {
  CREATED: 0,
  UPLOADED: 1,
  PROCESSING: 2,
  TRANSCODING: 3,
  FINISHED: 4,
  ERROR: 5,
  UPLOAD_FAILED: 6,
  JIT_SEGMENTING: 7,
  JIT_PLAYLISTS_CREATED: 8,
} as const;

export function isFinishedStatus(status: number | null | undefined): boolean {
  return status === BUNNY_STATUS.FINISHED || status === BUNNY_STATUS.JIT_PLAYLISTS_CREATED;
}

export function isFailedStatus(status: number | null | undefined): boolean {
  return status === BUNNY_STATUS.ERROR || status === BUNNY_STATUS.UPLOAD_FAILED;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asRecordStringString(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object") return null;
  if (Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(o)) {
    if (typeof val === "string") out[k] = val;
  }
  return Object.keys(out).length ? out : null;
}

function normalizeVideo(raw: unknown): Video | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = asString(o.id);
  const guid = asString(o.bunnyVideoGuid);
  const title = asString(o.title);
  if (!id || !guid || title === null) return null;
  return {
    id,
    bunnyVideoGuid: guid,
    title,
    description: asString(o.description),
    titleTranslations: asRecordStringString(o.titleTranslations),
    descriptionTranslations: asRecordStringString(o.descriptionTranslations),
    bunnyStatus: asNumber(o.bunnyStatus),
    hlsUrl: asString(o.hlsUrl),
    thumbnailUrl: asString(o.thumbnailUrl),
    previewUrl: asString(o.previewUrl),
    embedUrl: asString(o.embedUrl),
    durationSeconds: asNumber(o.durationSeconds),
    width: asNumber(o.width),
    height: asNumber(o.height),
    isActive: o.isActive === false ? false : Boolean(o.isActive),
    sortOrder: typeof o.sortOrder === "number" ? o.sortOrder : 0,
    createdAt: asString(o.createdAt),
    updatedAt: asString(o.updatedAt),
  };
}

function normalizeUploadSession(raw: unknown): UploadSessionResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const video = normalizeVideo(o.video);
  const tusRaw = o.tus as Record<string, unknown> | undefined;
  if (!video || !tusRaw || typeof tusRaw !== "object") return null;

  const libraryId = asString(tusRaw.libraryId);
  const videoId = asString(tusRaw.videoId);
  const authorizationExpire = asNumber(tusRaw.authorizationExpire);
  const authorizationSignature = asString(tusRaw.authorizationSignature);
  const tusEndpoint = asString(tusRaw.tusEndpoint);

  if (!libraryId || !videoId || authorizationExpire === null || !authorizationSignature || !tusEndpoint) {
    return null;
  }

  const meta = (o.tusMetadata as Record<string, unknown> | undefined) ?? {};
  const tusMetadata: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === "string" || typeof v === "number") tusMetadata[k] = v;
  }

  return {
    video,
    tus: {
      libraryId,
      videoId,
      authorizationExpire,
      authorizationSignature,
      tusEndpoint,
    },
    tusMetadata,
    embedUrl: asString(o.embedUrl) ?? video.embedUrl ?? "",
  };
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

export async function fetchVideos(): Promise<Video[]> {
  const res = await apiFetch("/api/videos", { method: "GET" });
  const raw = await readApiData<unknown>(res);
  return unwrapList(raw)
    .map((x) => normalizeVideo(x))
    .filter((x): x is Video => x !== null)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export async function fetchVideo(id: string, sync = false): Promise<Video> {
  const qs = sync ? "?sync=true" : "";
  const res = await apiFetch(`/api/videos/${encodeURIComponent(id)}${qs}`, { method: "GET" });
  const raw = await readApiData<unknown>(res);
  const video = normalizeVideo(raw);
  if (!video) throw new ApiError("Invalid video response", { statusCode: 502 });
  return video;
}

export async function createVideoUploadSession(
  input: CreateUploadSessionInput
): Promise<UploadSessionResponse> {
  const body: Record<string, unknown> = { title: input.title };
  if (input.description !== undefined) body.description = input.description;
  if (input.titleTranslations !== undefined) body.titleTranslations = input.titleTranslations;
  if (input.descriptionTranslations !== undefined) body.descriptionTranslations = input.descriptionTranslations;
  if (input.filetype !== undefined) body.filetype = input.filetype;
  if (input.tusTitle !== undefined) body.tusTitle = input.tusTitle;
  if (input.thumbnailTime !== undefined) body.thumbnailTime = input.thumbnailTime;

  const res = await apiFetch("/api/videos/upload-session", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const raw = await readApiData<unknown>(res);
  const session = normalizeUploadSession(raw);
  if (!session) throw new ApiError("Invalid upload session response", { statusCode: 502 });
  return session;
}

export async function updateVideo(id: string, patch: UpdateVideoInput): Promise<Video> {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.titleTranslations !== undefined) body.titleTranslations = patch.titleTranslations;
  if (patch.descriptionTranslations !== undefined) body.descriptionTranslations = patch.descriptionTranslations;
  if (patch.isActive !== undefined) body.isActive = patch.isActive;
  if (patch.sortOrder !== undefined) body.sortOrder = patch.sortOrder;

  const res = await apiFetch(`/api/videos/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const raw = await readApiData<unknown>(res);
  const video = normalizeVideo(raw);
  if (!video) throw new ApiError("Invalid video update response", { statusCode: 502 });
  return video;
}

export async function deleteVideo(id: string): Promise<void> {
  const res = await apiFetch(`/api/videos/${encodeURIComponent(id)}`, { method: "DELETE" });
  await readApiData<unknown>(res);
}

export type TusUploadHandle = {
  abort: () => Promise<void>;
};

export type StartTusUploadOptions = {
  session: UploadSessionResponse;
  file: File;
  onProgress?: (bytesSent: number, bytesTotal: number) => void;
  onSuccess?: () => void;
  onError?: (err: Error) => void;
};

/**
 * Starts a resumable Bunny Stream upload using the credentials returned by
 * `createVideoUploadSession`. Returns a handle to abort the upload.
 *
 * Bunny TUS auth headers are sent on every request so the upload server can
 * verify the SHA-256 signature created by the backend.
 *
 * @see https://docs.bunny.net/stream/tus-resumable-uploads
 */
export function startTusUpload(opts: StartTusUploadOptions): TusUploadHandle {
  const { session, file, onProgress, onSuccess, onError } = opts;

  const metadata: Record<string, string> = {};
  for (const [k, v] of Object.entries(session.tusMetadata)) {
    metadata[k] = String(v);
  }
  if (!metadata.filetype) metadata.filetype = file.type || "video/mp4";
  if (!metadata.title) metadata.title = file.name;

  const upload = new tus.Upload(file, {
    endpoint: session.tus.tusEndpoint,
    retryDelays: [0, 3000, 5000, 10000, 20000],
    headers: {
      AuthorizationSignature: session.tus.authorizationSignature,
      AuthorizationExpire: String(session.tus.authorizationExpire),
      VideoId: session.tus.videoId,
      LibraryId: session.tus.libraryId,
    },
    metadata,
    onProgress: (bytesSent, bytesTotal) => {
      onProgress?.(bytesSent, bytesTotal);
    },
    onSuccess: () => {
      onSuccess?.();
    },
    onError: (err) => {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    },
  });

  upload.start();

  return {
    abort: async () => {
      try {
        await upload.abort(true);
      } catch {
        /* ignore */
      }
    },
  };
}
