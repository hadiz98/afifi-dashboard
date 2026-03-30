"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/lib/toast-api-error";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import {
  RefreshCw,
  Plus,
  Newspaper,
  ArrowUpRight,
  Calendar,
  Tag,
  ImageIcon,
  LayoutGrid,
  List,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  Upload,
} from "lucide-react";
import {
  createNews,
  fetchNewsList,
  normalizeNewsItem,
  type NewsItem,
} from "@/lib/news-api";
import { cn } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────────────── */

type NewsFormState = {
  title: string;
  subtitle: string;
  description: string;
  subDescription: string;
  tags: string;
  date: string;
  isActive: boolean;
};

type ViewMode = "grid" | "list";

/* ─── Helpers ────────────────────────────────────────────────────── */

function parseNewsList(data: unknown): NewsItem[] {
  if (Array.isArray(data))
    return data.map((x) => normalizeNewsItem(x)).filter((x): x is NewsItem => !!x);
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const list =
      o.news ?? o.items ?? o.data ?? o.rows ?? o.results ?? o.refreshSessions;
    if (Array.isArray(list))
      return list.map((x) => normalizeNewsItem(x)).filter((x): x is NewsItem => !!x);
    const single = normalizeNewsItem(data);
    if (single) return [single];
  }
  return [];
}

function toIsoFromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatNewsDate(locale: string, value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
  } catch {
    return d.toISOString();
  }
}

/* ─── Stat Card ──────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {loading ? (
        <Skeleton className="mt-1.5 h-7 w-10" />
      ) : (
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-foreground">
          {value}
        </p>
      )}
    </div>
  );
}

/* ─── Status Badge ───────────────────────────────────────────────── */

function StatusBadge({ isActive }: { isActive?: boolean }) {
  const t = useTranslations("NewsPage");
  return isActive === false ? (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-destructive/30 bg-destructive/10 text-destructive",
        "dark:border-destructive/40 dark:bg-destructive/20"
      )}
    >
      <XCircle className="size-3" />
      {t("statusInactive")}
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
        "dark:border-emerald-400/35 dark:bg-emerald-400/15 dark:text-emerald-300"
      )}
    >
      <CheckCircle2 className="size-3" />
      {t("statusActive")}
    </Badge>
  );
}

/* ─── Grid Card ──────────────────────────────────────────────────── */

function NewsCardGrid({
  row,
  locale,
  t,
}: {
  row: NewsItem;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <Card className="group flex flex-col overflow-hidden border shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-40 w-full overflow-hidden bg-muted">
        {row.image ? (
          <img
            src={row.image}
            alt={row.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5">
          <StatusBadge isActive={row.isActive} />
        </div>
      </div>

      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {row.title}
          </p>
          {row.subtitle && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {row.subtitle}
            </p>
          )}
        </div>

        {(row.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {(row.tags ?? []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs font-normal">
                {tag}
              </Badge>
            ))}
            {(row.tags?.length ?? 0) > 3 && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{(row.tags?.length ?? 0) - 3}
              </Badge>
            )}
          </div>
        )}

        <Separator />

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            {formatNewsDate(locale, row.date ?? row.createdAt)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            render={
              <Link href={`/news/${encodeURIComponent(row.id)}`}>
                {t("view")}
                <ArrowUpRight className="size-3" />
              </Link>
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Panel ─────────────────────────────────────────────────── */

export function NewsPanel() {
  const t = useTranslations("NewsPage");
  const locale = useLocale();

  const [rows, setRows] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<NewsFormState>({
    title: "",
    subtitle: "",
    description: "",
    subDescription: "",
    tags: "",
    date: "",
    isActive: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchNewsList({ page: 1, limit: 50 });
      setRows(parseNewsList(data));
    } catch (e) {
      toastApiError(e, t("loadError"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, []);

  const filtered = rows.filter(
    (r) =>
      !search.trim() ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      (r.subtitle ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const submitDisabled = submitting || !form.title.trim() || !imageFile;

  async function onCreate() {
    if (!imageFile) return;
    const fd = new FormData();
    fd.append("title", form.title.trim());
    if (form.subtitle.trim()) fd.append("subtitle", form.subtitle.trim());
    if (form.description.trim()) fd.append("description", form.description.trim());
    if (form.subDescription.trim()) fd.append("subDescription", form.subDescription.trim());
    if (form.tags.trim()) fd.append("tags", form.tags.trim());
    const iso = toIsoFromDateTimeLocal(form.date);
    if (iso) fd.append("date", iso);
    fd.append("isActive", form.isActive ? "true" : "false");
    fd.append("image", imageFile);

    setSubmitting(true);
    try {
      await createNews(fd);
      toast.success(t("createSuccess"));
      setCreateOpen(false);
      setForm({
        title: "",
        subtitle: "",
        description: "",
        subDescription: "",
        tags: "",
        date: "",
        isActive: true,
      });
      setImageFile(null);
      await load();
    } catch (e) {
      toastApiError(e, t("createError"));
    } finally {
      setSubmitting(false);
    }
  }

  const activeCount = rows.filter((r) => r.isActive !== false).length;
  const inactiveCount = rows.filter((r) => r.isActive === false).length;

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8">

          {/* ── Page Header ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card shadow-sm">
                <Newspaper className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  {t("title")}
                </h1>
                <p className="text-sm text-muted-foreground">{t("description")}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={loading}
                onClick={() => void load()}
              >
                <RefreshCw
                  className={`size-3.5 ${loading ? "animate-spin" : ""}`}
                />
                {t("refresh")}
              </Button>

              <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" />
                {t("addNews")}
              </Button>
            </div>
          </div>

          {/* ── Stats ── */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label={t("countLabel")} value={rows.length} loading={loading} />
            <StatCard label={t("statusActive")} value={activeCount} loading={loading} />
            <StatCard label={t("statusInactive")} value={inactiveCount} loading={loading} />
          </div>

          {/* ── Main Card ── */}
          <Card className="bg-card shadow-sm">
            {/* Toolbar */}
            <CardHeader className="border-b px-6 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search articles…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>

                {/* View mode toggle */}
                <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5">
                  {(["list", "grid"] as ViewMode[]).map((mode) => (
                    <Tooltip key={mode}>
                      <TooltipTrigger>
                        <button
                          type="button"
                          onClick={() => setViewMode(mode)}
                          className={cn(
                            "rounded px-2 py-1 transition-all",
                            viewMode === mode
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {mode === "list" ? (
                            <List className="size-4" />
                          ) : (
                            <LayoutGrid className="size-4" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {mode === "list" ? "List view" : "Grid view"}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* ── Loading ── */}
              {loading ? (
                viewMode === "list" ? (
                  <div className="divide-y">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-4 px-6 py-4">
                        <Skeleton className="h-9 w-14 rounded-md" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-52" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                        <Skeleton className="h-5 w-16 rounded-full" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-7 w-14 rounded-md" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="overflow-hidden rounded-lg border">
                        <Skeleton className="h-40 w-full rounded-none" />
                        <div className="space-y-2 p-4">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : filtered.length === 0 ? (
                /* ── Empty state ── */
                <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border bg-muted/50">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {search ? "No results found" : t("empty")}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {search
                        ? `No articles match "${search}"`
                        : "Create your first news article to get started."}
                    </p>
                  </div>
                  {!search && (
                    <Button
                      size="sm"
                      className="mt-1 gap-1.5"
                      onClick={() => setCreateOpen(true)}
                    >
                      <Plus className="size-3.5" />
                      {t("addNews")}
                    </Button>
                  )}
                </div>
              ) : viewMode === "grid" ? (
                /* ── Grid ── */
                <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((row) => (
                    <NewsCardGrid key={row.id} row={row} locale={locale} t={t} />
                  ))}
                </div>
              ) : (
                /* ── Table ── */
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6 w-[38%]">{t("colTitle")}</TableHead>
                      <TableHead>{t("colStatus")}</TableHead>
                      <TableHead>{t("colDate")}</TableHead>
                      <TableHead>{t("colTags")}</TableHead>
                      <TableHead className="pr-6 w-px text-right">
                        {t("colAction")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row.id} className="group">
                        {/* Title */}
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                              {row.image ? (
                                <img
                                  src={row.image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center">
                                  <ImageIcon className="size-3.5 text-muted-foreground/40" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {row.title}
                              </p>
                              {row.subtitle && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {row.subtitle}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <StatusBadge isActive={row.isActive} />
                        </TableCell>

                        {/* Date */}
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="size-3 shrink-0" />
                            {formatNewsDate(locale, row.date ?? row.createdAt)}
                          </span>
                        </TableCell>

                        {/* Tags */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(row.tags ?? []).slice(0, 3).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs font-normal"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {(row.tags?.length ?? 0) > 3 && (
                              <Badge
                                variant="outline"
                                className="text-xs text-muted-foreground"
                              >
                                +{(row.tags?.length ?? 0) - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Action */}
                        <TableCell className="pr-6 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            render={
                              <Link href={`/news/${encodeURIComponent(row.id)}`}>
                                {t("view")}
                                <ArrowUpRight className="size-3" />
                              </Link>
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Newspaper className="size-4 text-muted-foreground" />
              {t("dialogCreateTitle")}
            </DialogTitle>
            <DialogDescription>{t("dialogCreateDescription")}</DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-1 pr-1">
            {/* Title */}
            <div className="grid gap-1.5">
              <Label htmlFor="news-title">
                {t("fieldTitle")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="news-title"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Article headline…"
              />
            </div>

            {/* Subtitle */}
            <div className="grid gap-1.5">
              <Label htmlFor="news-subtitle">{t("fieldSubtitle")}</Label>
              <Input
                id="news-subtitle"
                value={form.subtitle}
                onChange={(e) => setForm((s) => ({ ...s, subtitle: e.target.value }))}
                placeholder="Short summary…"
              />
            </div>

            {/* Description */}
            <div className="grid gap-1.5">
              <Label htmlFor="news-description">{t("fieldDescription")}</Label>
              <Textarea
                id="news-description"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((s) => ({ ...s, description: e.target.value }))
                }
                placeholder="Main content…"
                className="resize-none"
              />
            </div>

            {/* Sub-description */}
            <div className="grid gap-1.5">
              <Label htmlFor="news-subDescription">{t("fieldSubDescription")}</Label>
              <Textarea
                id="news-subDescription"
                rows={2}
                value={form.subDescription}
                onChange={(e) =>
                  setForm((s) => ({ ...s, subDescription: e.target.value }))
                }
                placeholder="Additional details…"
                className="resize-none"
              />
            </div>

            {/* Tags + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="news-tags" className="flex items-center gap-1.5">
                  <Tag className="size-3 text-muted-foreground" />
                  {t("fieldTags")}
                </Label>
                <Input
                  id="news-tags"
                  placeholder={t("fieldTagsPlaceholder")}
                  value={form.tags}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, tags: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="news-date" className="flex items-center gap-1.5">
                  <Calendar className="size-3 text-muted-foreground" />
                  {t("fieldDate")}
                </Label>
                <Input
                  id="news-date"
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, date: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="news-isActive"
                  className="cursor-pointer text-sm font-medium"
                >
                  {t("fieldIsActive")}
                </Label>
                <StatusBadge isActive={form.isActive} />
              </div>
              <Switch
                id="news-isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
              />
            </div>

            {/* Image upload */}
            <div className="grid gap-1.5">
              <Label>
                {t("fieldImage")} <span className="text-destructive">*</span>
              </Label>
              <label
                htmlFor="news-image"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/10 py-8 text-center transition-colors hover:bg-muted/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-white shadow-sm">
                  {imageFile ? (
                    <ImageIcon className="size-4 text-foreground" />
                  ) : (
                    <Upload className="size-4 text-muted-foreground" />
                  )}
                </div>
                {imageFile ? (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {imageFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(imageFile.size / 1024).toFixed(1)} KB · click to replace
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Click to upload
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, WEBP up to 10 MB
                    </p>
                  </div>
                )}
                <Input
                  id="news-image"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={() => void onCreate()}
              disabled={submitDisabled}
              className="gap-1.5"
            >
              {submitting ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}