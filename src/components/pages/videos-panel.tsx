"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Film,
  Plus,
  RefreshCw,
  Trash2,
  PencilLine,
  Upload,
  ExternalLink,
  Play,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toastApiError } from "@/lib/toast-api-error";
import {
  BUNNY_STATUS,
  createVideoUploadSession,
  deleteVideo,
  fetchVideo,
  fetchVideos,
  isFailedStatus,
  isFinishedStatus,
  startTusUpload,
  updateVideo,
  type TusUploadHandle,
  type Video,
} from "@/lib/videos-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const VIDEO_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const VIDEO_ACCEPT = "video/*";

function formatDuration(seconds: number | null | undefined): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

type StatusKind = "ready" | "processing" | "failed" | "pending";

function statusKind(s: number | null | undefined): StatusKind {
  if (isFinishedStatus(s)) return "ready";
  if (isFailedStatus(s)) return "failed";
  if (s === BUNNY_STATUS.CREATED || s === null || s === undefined) return "pending";
  return "processing";
}

export function VideosPanel() {
  const t = useTranslations("VideosPage");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Video[]>([]);
  const [thumbErrors, setThumbErrors] = useState<Record<string, true>>({});
  const [thumbNonce, setThumbNonce] = useState<Record<string, number>>({});

  const [submitting, setSubmitting] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ sent: number; total: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const tusHandleRef = useRef<TusUploadHandle | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editSortOrder, setEditSortOrder] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchVideos());
    } catch (e) {
      toastApiError(e, t("loadError"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (tusHandleRef.current) {
        void tusHandleRef.current.abort();
        tusHandleRef.current = null;
      }
    };
  }, []);

  // Auto-sync rows still being processed by Bunny so thumbnails appear without
  // user interaction. Polls per-row every ~8s; stops once everything is ready.
  useEffect(() => {
    if (loading) return;
    const pendingIds = rows
      .filter((r) => statusKind(r.bunnyStatus) !== "ready" && statusKind(r.bunnyStatus) !== "failed")
      .map((r) => r.id);
    if (pendingIds.length === 0) return;

    let cancelled = false;
    const interval = window.setInterval(async () => {
      for (const id of pendingIds) {
        if (cancelled) return;
        try {
          const updated = await fetchVideo(id, true);
          if (cancelled) return;
          setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          if (isFinishedStatus(updated.bunnyStatus)) {
            setThumbErrors((prev) => {
              if (!prev[updated.id]) return prev;
              const next = { ...prev };
              delete next[updated.id];
              return next;
            });
            setThumbNonce((prev) => ({ ...prev, [updated.id]: Date.now() }));
          }
        } catch {
          /* keep polling silently */
        }
      }
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [rows, loading]);

  const progressPercent = useMemo(() => {
    if (!uploadProgress || uploadProgress.total <= 0) return 0;
    return Math.min(100, Math.round((uploadProgress.sent / uploadProgress.total) * 100));
  }, [uploadProgress]);

  function resetUploadState() {
    setUploadFile(null);
    setUploadTitle("");
    setUploadDescription("");
    setUploadError(null);
    setUploadProgress(null);
    setUploading(false);
  }

  function onUploadDialogOpenChange(open: boolean) {
    if (!open && uploading) return;
    setUploadOpen(open);
    if (!open) resetUploadState();
  }

  function onPickUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    if (file.size > VIDEO_MAX_FILE_BYTES) {
      setUploadError(t("fileTooLarge", { max: "2 GB" }));
      return;
    }
    if (!file.type.startsWith("video/")) {
      setUploadError(t("invalidFileType"));
      return;
    }
    setUploadError(null);
    setUploadFile(file);
    if (!uploadTitle.trim()) {
      const baseName = file.name.replace(/\.[^.]+$/, "");
      setUploadTitle(baseName);
    }
  }

  async function onUpload() {
    const title = uploadTitle.trim();
    if (!title) {
      setUploadError(t("titleRequired"));
      toast.error(t("titleRequired"));
      return;
    }
    if (!uploadFile) {
      setUploadError(t("fileRequired"));
      toast.error(t("fileRequired"));
      return;
    }

    setSubmitting(true);
    setUploading(true);
    setUploadError(null);
    setUploadProgress({ sent: 0, total: uploadFile.size });

    let session;
    try {
      session = await createVideoUploadSession({
        title,
        description: uploadDescription.trim() || undefined,
        filetype: uploadFile.type || "video/mp4",
        tusTitle: uploadFile.name,
      });
    } catch (e) {
      setUploading(false);
      setSubmitting(false);
      setUploadProgress(null);
      toastApiError(e, t("uploadError"));
      return;
    }

    await new Promise<void>((resolve) => {
      tusHandleRef.current = startTusUpload({
        session,
        file: uploadFile,
        onProgress: (sent, total) => {
          setUploadProgress({ sent, total });
        },
        onSuccess: () => {
          tusHandleRef.current = null;
          resolve();
        },
        onError: (err) => {
          tusHandleRef.current = null;
          setUploadError(err.message);
          toast.error(err.message || t("uploadError"));
          resolve();
        },
      });
    });

    if (uploadError) {
      setUploading(false);
      setSubmitting(false);
      return;
    }

    try {
      await fetchVideo(session.video.id, true);
    } catch {
      /* sync failure is non-fatal — Bunny may still be processing */
    }

    toast.success(t("uploadSuccess"));
    setUploading(false);
    setSubmitting(false);
    onUploadDialogOpenChange(false);
    await load();
  }

  function onCancelUpload() {
    if (tusHandleRef.current) {
      void tusHandleRef.current.abort();
      tusHandleRef.current = null;
    }
    setUploading(false);
    setSubmitting(false);
    setUploadProgress(null);
    toast.message(t("uploadCancelled"));
  }

  function openEdit(row: Video) {
    setEditId(row.id);
    setEditTitle(row.title);
    setEditDescription(row.description ?? "");
    setEditIsActive(row.isActive);
    setEditSortOrder(typeof row.sortOrder === "number" ? String(row.sortOrder) : "");
    setEditOpen(true);
  }

  async function onSaveMeta() {
    if (!editId) return;
    const title = editTitle.trim();
    if (!title) {
      toast.error(t("titleRequired"));
      return;
    }
    const sortRaw = editSortOrder.trim();
    if (sortRaw && !Number.isFinite(Number(sortRaw))) {
      toast.error(t("invalidSortOrder"));
      return;
    }
    setSubmitting(true);
    try {
      await updateVideo(editId, {
        title,
        description: editDescription.trim() ? editDescription.trim() : null,
        isActive: editIsActive,
        sortOrder: sortRaw ? Number(sortRaw) : undefined,
      });
      toast.success(t("editSuccess"));
      setEditOpen(false);
      setEditId(null);
      await load();
    } catch (e) {
      toastApiError(e, t("editError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      await deleteVideo(deleteId);
      toast.success(t("deleteSuccess"));
      setDeleteOpen(false);
      setDeleteId(null);
      await load();
    } catch (e) {
      toastApiError(e, t("deleteError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function onSync(row: Video) {
    setSyncingId(row.id);
    try {
      const updated = await fetchVideo(row.id, true);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setThumbErrors((prev) => {
        if (!prev[updated.id]) return prev;
        const next = { ...prev };
        delete next[updated.id];
        return next;
      });
      setThumbNonce((prev) => ({ ...prev, [updated.id]: Date.now() }));
      toast.success(t("syncSuccess"));
    } catch (e) {
      toastApiError(e, t("syncError"));
    } finally {
      setSyncingId(null);
    }
  }

  function statusLabel(s: number | null | undefined): string {
    const kind = statusKind(s);
    return t(`status.${kind}`);
  }

  function statusBadgeClass(s: number | null | undefined): string {
    const kind = statusKind(s);
    if (kind === "ready") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    if (kind === "processing") return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    if (kind === "failed") return "bg-destructive/10 text-destructive border-destructive/20";
    return "bg-muted text-muted-foreground border-border";
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <Film className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">{t("title")}</h1>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={loading || submitting}
            onClick={() => void load()}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={submitting}
            onClick={() => setUploadOpen(true)}
          >
            <Plus className="size-3" />
            {t("upload")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{t("gridTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("count", { count: rows.length })}</p>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-video rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 py-10 text-center transition-colors hover:bg-muted/40 hover:border-border"
            >
              <div className="flex size-10 items-center justify-center rounded-full border border-border/60 bg-background shadow-sm">
                <Upload className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("empty")}</p>
                <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
              </div>
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r) => {
                const ready = isFinishedStatus(r.bunnyStatus);
                const nonce = thumbNonce[r.id];
                const thumbSrc =
                  r.thumbnailUrl && !thumbErrors[r.id]
                    ? nonce
                      ? `${r.thumbnailUrl}${r.thumbnailUrl.includes("?") ? "&" : "?"}v=${nonce}`
                      : r.thumbnailUrl
                    : null;
                return (
                  <div
                    key={r.id}
                    className="group overflow-hidden rounded-xl border border-border/60 bg-card transition-shadow hover:shadow-sm"
                  >
                    <button
                      type="button"
                      className="relative block aspect-video w-full overflow-hidden bg-muted"
                      onClick={() => {
                        if (!r.embedUrl) return;
                        setPreviewVideo(r);
                        setPreviewOpen(true);
                      }}
                      disabled={!r.embedUrl}
                    >
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={() => {
                            setThumbErrors((prev) => ({ ...prev, [r.id]: true }));
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                          <Film className="size-10 text-muted-foreground/30" />
                          {!ready ? (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {t(`status.${statusKind(r.bunnyStatus)}`)}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {r.embedUrl ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
                          <div className="flex size-12 items-center justify-center rounded-full bg-background/90 shadow-lg">
                            <Play className="size-5 text-foreground" />
                          </div>
                        </div>
                      ) : null}
                      {typeof r.durationSeconds === "number" && r.durationSeconds > 0 ? (
                        <span className="absolute bottom-2 end-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white">
                          {formatDuration(r.durationSeconds)}
                        </span>
                      ) : null}
                      {!r.isActive ? (
                        <span className="absolute top-2 start-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white">
                          {t("hidden")}
                        </span>
                      ) : null}
                    </button>

                    <div className="space-y-2 border-t border-border/60 bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground" title={r.title}>
                            {r.title}
                          </p>
                          {r.description ? (
                            <p
                              className="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
                              title={r.description}
                            >
                              {r.description}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                            statusBadgeClass(r.bunnyStatus)
                          )}
                        >
                          {statusLabel(r.bunnyStatus)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={submitting}
                          onClick={() => openEdit(r)}
                          title={t("edit")}
                        >
                          <PencilLine className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={submitting || syncingId === r.id}
                          onClick={() => void onSync(r)}
                          title={t("sync")}
                        >
                          <RefreshCw className={cn("size-3.5", syncingId === r.id && "animate-spin")} />
                        </Button>
                        {r.embedUrl ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={submitting || !ready}
                            onClick={() =>
                              window.open(r.embedUrl!, "_blank", "noopener,noreferrer")
                            }
                            title={t("openExternal")}
                          >
                            <ExternalLink className="size-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="ms-auto h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={submitting}
                          onClick={() => {
                            setDeleteId(r.id);
                            setDeleteOpen(true);
                          }}
                          title={t("delete")}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={onUploadDialogOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <Upload className="size-3.5 text-muted-foreground" />
              </div>
              {t("uploadTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("uploadDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("file")}
              </Label>
              <input
                ref={uploadInputRef}
                type="file"
                accept={VIDEO_ACCEPT}
                className="sr-only"
                onChange={onPickUploadFile}
              />
              {!uploadFile ? (
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploading}
                  className="flex min-h-[110px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-xs transition-colors hover:border-border disabled:opacity-50"
                >
                  <span className="pointer-events-none flex flex-col items-center gap-2">
                    <Upload className="size-6 text-muted-foreground" />
                    <span className="font-medium text-foreground">{t("pickFileHint")}</span>
                    <span className="text-muted-foreground">{t("limitsHint")}</span>
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/10 p-2 text-xs">
                  <Film className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                    {uploadFile.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatBytes(uploadFile.size)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={uploading}
                    onClick={() => {
                      setUploadFile(null);
                      setUploadError(null);
                    }}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              )}
              {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("titleField")}
              </Label>
              <Input
                value={uploadTitle}
                disabled={uploading}
                className="h-9"
                placeholder={t("titlePlaceholder")}
                onChange={(e) => setUploadTitle(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("descriptionField")}
              </Label>
              <Textarea
                value={uploadDescription}
                disabled={uploading}
                placeholder={t("descriptionPlaceholder")}
                onChange={(e) => setUploadDescription(e.target.value)}
                maxLength={10000}
                className="min-h-[80px]"
              />
            </div>
            {uploading && uploadProgress ? (
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{t("uploadingLabel")}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {progressPercent}% · {formatBytes(uploadProgress.sent)} /{" "}
                    {formatBytes(uploadProgress.total)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            {uploading ? (
              <Button type="button" variant="outline" onClick={onCancelUpload} className="gap-1.5">
                <X className="size-3.5" />
                {t("cancelUpload")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => onUploadDialogOpenChange(false)}
              >
                {t("cancel")}
              </Button>
            )}
            <Button
              type="button"
              disabled={uploading || !uploadFile || !uploadTitle.trim()}
              onClick={() => void onUpload()}
              className="gap-1.5"
            >
              {uploading ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {uploading ? t("uploadingLabel") : t("upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditId(null);
            setEditTitle("");
            setEditDescription("");
            setEditIsActive(true);
            setEditSortOrder("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border bg-muted">
                <PencilLine className="size-3.5 text-muted-foreground" />
              </div>
              {t("editTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("editDescription")}</DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("titleField")}
              </Label>
              <Input
                value={editTitle}
                className="h-9"
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={500}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("descriptionField")}
              </Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={10000}
                className="min-h-[80px]"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{t("activeLabel")}</p>
                <p className="text-[11px] leading-snug text-muted-foreground">{t("activeHint")}</p>
              </div>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("sortOrder")}
              </Label>
              <Input
                inputMode="numeric"
                value={editSortOrder}
                placeholder="0"
                className="h-9"
                onChange={(e) => setEditSortOrder(e.target.value)}
              />
              <p className="text-[11px] leading-snug text-muted-foreground">{t("sortOrderHint")}</p>
            </div>
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={submitting || !editId || !editTitle.trim()}
              onClick={() => void onSaveMeta()}
              className="gap-1.5"
            >
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <PencilLine className="size-3.5" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteId(null);
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <div className="flex size-7 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5">
                <Trash2 className="size-3.5 text-destructive" />
              </div>
              {t("deleteTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs">{t("deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setDeleteOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={submitting || !deleteId}
              onClick={() => void onDelete()}
              className="gap-1.5"
            >
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewVideo(null);
        }}
      >
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{previewVideo?.title ?? ""}</DialogTitle>
          </DialogHeader>
          {previewVideo?.embedUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-border/60 bg-black">
              <iframe
                src={previewVideo.embedUrl}
                title={previewVideo.title}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
