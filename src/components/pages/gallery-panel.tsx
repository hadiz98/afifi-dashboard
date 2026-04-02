"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  Image as ImageIcon,
  Images,
  Plus,
  RefreshCw,
  Trash2,
  PencilLine,
  Upload,
  ExternalLink,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { toastApiError } from "@/lib/toast-api-error";
import {
  deleteGalleryImage,
  fetchGallery,
  type GalleryItem,
  uploadGalleryImages,
  updateGalleryMeta,
} from "@/lib/gallery-api";
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

const GALLERY_TOTAL_MAX = 20;
const GALLERY_MAX_FILES_PER_REQUEST = 20;
const GALLERY_MAX_FILE_BYTES = 10 * 1024 * 1024;
const GALLERY_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

function isAllowedGalleryFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) return true;
  const name = file.name.toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

function pickInstagramHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function GalleryPanel() {
  const t = useTranslations("GalleryPage");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<GalleryItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadInstagramLink, setUploadInstagramLink] = useState("");
  const [uploadSortOrderBase, setUploadSortOrderBase] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Edit meta dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editInstagramLink, setEditInstagramLink] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("");

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchGallery());
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

  const remainingSlots = useMemo(() => Math.max(0, GALLERY_TOTAL_MAX - rows.length), [rows.length]);

  function resetUploadState() {
    setUploadFiles([]);
    setUploadInstagramLink("");
    setUploadSortOrderBase("");
    setUploadError(null);
  }

  function onUploadDialogOpenChange(open: boolean) {
    setUploadOpen(open);
    if (!open) resetUploadState();
  }

  function addFiles(prev: File[], incoming: File[]): { next: File[]; error: string | null } {
    if (!incoming.length) return { next: prev, error: null };
    if (prev.length + incoming.length > GALLERY_MAX_FILES_PER_REQUEST) {
      return { next: prev, error: t("tooManyFiles") };
    }
    if (rows.length + prev.length + incoming.length > GALLERY_TOTAL_MAX) {
      return { next: prev, error: t("overGlobalCap", { max: GALLERY_TOTAL_MAX }) };
    }
    for (const f of incoming) {
      if (f.size > GALLERY_MAX_FILE_BYTES) return { next: prev, error: t("fileTooLarge") };
      if (!isAllowedGalleryFile(f)) return { next: prev, error: t("invalidFileType") };
    }
    return { next: [...prev, ...incoming], error: null };
  }

  function onPickUploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (!list.length) return;
    setUploadFiles((prev) => {
      const { next, error } = addFiles(prev, list);
      setUploadError(error);
      return error ? prev : next;
    });
  }

  function validateInstagramLink(value: string): string | null {
    const v = value.trim();
    if (!v) return null;
    const host = pickInstagramHost(v);
    if (!host) return t("invalidInstagramLink");
    if (!(host === "instagram.com" || host.endsWith(".instagram.com"))) return t("invalidInstagramLink");
    return null;
  }

  async function onUpload() {
    const err = validateInstagramLink(uploadInstagramLink);
    if (err) {
      setUploadError(err);
      toast.error(err);
      return;
    }
    if (!uploadFiles.length) {
      toast.error(t("fileRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const sortBase = uploadSortOrderBase.trim();
      await uploadGalleryImages({
        files: uploadFiles,
        instagramLink: uploadInstagramLink.trim() || undefined,
        sortOrderBase: sortBase ? Number(sortBase) : undefined,
      });
      toast.success(
        uploadFiles.length === 1 ? t("uploadSuccess") : t("uploadSuccessMany", { count: uploadFiles.length })
      );
      onUploadDialogOpenChange(false);
      await load();
    } catch (e) {
      toastApiError(e, t("uploadError"));
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(row: GalleryItem) {
    setEditId(row.id);
    setEditInstagramLink(row.instagramLink ?? "");
    setEditSortOrder(typeof row.sortOrder === "number" ? String(row.sortOrder) : "");
    setEditOpen(true);
  }

  async function onSaveMeta() {
    if (!editId) return;
    const err = validateInstagramLink(editInstagramLink);
    if (err) {
      toast.error(err);
      return;
    }
    const sort = editSortOrder.trim();
    if (sort && !Number.isFinite(Number(sort))) {
      toast.error(t("invalidSortOrder"));
      return;
    }
    setSubmitting(true);
    try {
      await updateGalleryMeta(editId, {
        instagramLink: editInstagramLink.trim(),
        sortOrder: sort ? Number(sort) : undefined,
      });
      toast.success(t("editSuccess"));
      setEditOpen(false);
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
      await deleteGalleryImage(deleteId);
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

  function moveRow(index: number, direction: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const to = index + direction;
      if (index < 0 || index >= next.length || to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  async function persistOrder() {
    if (rows.length < 2) return;
    setSubmitting(true);
    try {
      for (let idx = 0; idx < rows.length; idx += 1) {
        const r = rows[idx]!;
        await updateGalleryMeta(r.id, { sortOrder: idx * 10 });
      }
      toast.success(t("reorderSuccess"));
      await load();
      setReorderMode(false);
    } catch (e) {
      toastApiError(e, t("reorderError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <Images className="size-4 text-muted-foreground" />
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
          {reorderMode ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={submitting}
                onClick={() => setReorderMode(false)}
              >
                {t("done")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                disabled={submitting || rows.length < 2}
                onClick={() => void persistOrder()}
              >
                {t("saveOrder")}
              </Button>
            </>
          ) : rows.length >= 2 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={submitting}
              onClick={() => setReorderMode(true)}
            >
              {t("reorder")}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={submitting || remainingSlots === 0}
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
          <p className="text-xs text-muted-foreground">
            {t("count", { count: rows.length, max: GALLERY_TOTAL_MAX })}
          </p>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
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
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {rows.map((r, idx) => (
                <div key={r.id} className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted">
                  <div className="relative block aspect-[4/3] w-full overflow-hidden">
                    <img
                      src={r.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {!r.url ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="size-8 text-muted-foreground/30" />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1 border-t border-border/60 bg-background p-1.5">
                    {reorderMode ? (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-6 w-6"
                          disabled={idx === 0 || submitting}
                          onClick={() => moveRow(idx, -1)}
                        >
                          <ArrowUp className="size-3" />
                        </Button>
                        <span className="text-[10px] text-muted-foreground">
                          {typeof r.sortOrder === "number" ? r.sortOrder : "—"}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="ms-auto h-6 w-6"
                          disabled={idx === rows.length - 1 || submitting}
                          onClick={() => moveRow(idx, 1)}
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          disabled={submitting}
                          onClick={() => openEdit(r)}
                        >
                          <PencilLine className="size-3" />
                        </Button>
                        {r.instagramLink?.trim() ? (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            disabled={submitting}
                            onClick={() => window.open(r.instagramLink!, "_blank", "noopener,noreferrer")}
                          >
                            <ExternalLink className="size-3" />
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="ms-auto h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={submitting}
                          onClick={() => {
                            setDeleteId(r.id);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
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
            <DialogDescription className="text-xs">
              {t("uploadDescription", { max: GALLERY_TOTAL_MAX })}
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("files")}</Label>
              <input
                ref={uploadInputRef}
                type="file"
                accept={GALLERY_ACCEPT}
                multiple
                className="sr-only"
                onChange={onPickUploadFiles}
              />
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="flex min-h-[110px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center text-xs transition-colors hover:border-border"
              >
                <span className="pointer-events-none flex flex-col items-center gap-2">
                  <Upload className="size-6 text-muted-foreground" />
                  <span className="font-medium text-foreground">{t("pickFilesHint")}</span>
                  <span className="text-muted-foreground">{t("limitsHint")}</span>
                </span>
              </button>
              {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
              {uploadFiles.length > 0 ? (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-border/60 bg-muted/10 p-2">
                  {uploadFiles.map((f, idx) => (
                    <li key={`${f.name}-${f.size}-${idx}`} className="flex items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{f.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
                          setUploadError(null);
                        }}
                      >
                        ×
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("instagramLink")}</Label>
              <Input
                value={uploadInstagramLink}
                className="h-9"
                placeholder="https://instagram.com/..."
                onChange={(e) => setUploadInstagramLink(e.target.value)}
              />
              <p className="text-[11px] leading-snug text-muted-foreground">{t("instagramHint")}</p>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("sortOrderBase")}</Label>
              <Input
                inputMode="numeric"
                value={uploadSortOrderBase}
                placeholder="0"
                className="h-9"
                onChange={(e) => setUploadSortOrderBase(e.target.value)}
              />
              <p className="text-[11px] leading-snug text-muted-foreground">{t("sortOrderBaseHint")}</p>
            </div>
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onUploadDialogOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              disabled={submitting || uploadFiles.length === 0}
              onClick={() => void onUpload()}
              className="gap-1.5"
            >
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {t("upload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit meta dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditId(null);
            setEditInstagramLink("");
            setEditSortOrder("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
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
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("instagramLink")}</Label>
              <Input
                value={editInstagramLink}
                className="h-9"
                placeholder="https://instagram.com/..."
                onChange={(e) => setEditInstagramLink(e.target.value)}
              />
              <p className="text-[11px] leading-snug text-muted-foreground">{t("instagramHint")}</p>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("sortOrder")}</Label>
              <Input
                inputMode="numeric"
                value={editSortOrder}
                placeholder="0"
                className="h-9"
                onChange={(e) => setEditSortOrder(e.target.value)}
              />
            </div>
          </div>
          <Separator />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => setEditOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={submitting || !editId} onClick={() => void onSaveMeta()} className="gap-1.5">
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
            <Button type="button" variant="destructive" disabled={submitting || !deleteId} onClick={() => void onDelete()} className="gap-1.5">
              {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

