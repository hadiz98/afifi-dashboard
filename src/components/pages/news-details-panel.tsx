"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/lib/toast-api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { fetchNewsById, updateNews } from "@/lib/news-api";
import type { NewsItem } from "@/lib/news-api";

type EditFormState = {
  title: string;
  subtitle: string;
  description: string;
  subDescription: string;
  tags: string;
  date: string;
  isActive: boolean;
};

function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Convert to local datetime-local format: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoFromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) return "";
  return tags.join(", ");
}

function safeString(v: string | null | undefined): string {
  return typeof v === "string" ? v : "";
}

export function NewsDetailsPanel({ id }: { id: string }) {
  const t = useTranslations("NewsDetailsPage");
  const tCommon = useTranslations("NewsPage");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [form, setForm] = useState<EditFormState>({
    title: "",
    subtitle: "",
    description: "",
    subDescription: "",
    tags: "",
    date: "",
    isActive: true,
  });

  function renderStatusBadge(isActive?: boolean) {
    if (isActive === false) {
      return (
        <Badge variant="outline">{tCommon("statusInactive")}</Badge>
      );
    }
    return <Badge>{tCommon("statusActive")}</Badge>;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const item = await fetchNewsById(id);
      setNews(item);
      setForm({
        title: safeString(item.title),
        subtitle: safeString(item.subtitle),
        description: safeString(item.description),
        subDescription: safeString(item.subDescription),
        tags: parseTags(item.tags),
        date: toDateTimeLocalValue(item.date),
        isActive: item.isActive !== false,
      });
    } catch (e) {
      toastApiError(e, t("loadError"));
      setError(t("loadError"));
      setNews(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function formatDate(value?: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
    } catch {
      return d.toISOString();
    }
  }

  async function onUpdate() {
    if (!news) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title.trim());
      if (form.subtitle.trim()) fd.append("subtitle", form.subtitle.trim());
      if (form.description.trim()) fd.append("description", form.description.trim());
      if (form.subDescription.trim())
        fd.append("subDescription", form.subDescription.trim());
      if (form.tags.trim()) fd.append("tags", form.tags.trim());

      const iso = toIsoFromDateTimeLocal(form.date);
      if (iso) fd.append("date", iso);

      fd.append("isActive", form.isActive ? "true" : "false");
      if (imageFile) fd.append("image", imageFile);

      await updateNews(id, fd);
      toast.success(tCommon("updateSuccess"));
      setEditOpen(false);
      setImageFile(null);
      await load();
    } catch (e) {
      toastApiError(e, tCommon("updateError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-80" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[70%]" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!news || error) {
    return (
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-2xl">{news.title}</CardTitle>
              {news.subtitle ? (
                <CardDescription className="mt-1">{news.subtitle}</CardDescription>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {renderStatusBadge(news.isActive)}
                <Badge variant="secondary">{formatDate(news.date)}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/news">{t("back")}</Link>}
              />
              <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
                {t("edit")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {news.image ? (
            <div className="relative w-full overflow-hidden rounded-lg border bg-muted">
              <img
                src={news.image}
                alt=""
                className="h-auto w-full object-cover"
                loading="lazy"
              />
            </div>
          ) : null}

          <div className="space-y-3">
            {news.description ? <p className="whitespace-pre-wrap">{news.description}</p> : null}
            {news.subDescription ? (
              <p className="text-sm text-muted-foreground">{news.subDescription}</p>
            ) : null}
          </div>

          {news.tags && news.tags.length > 0 ? (
            <div>
              <div className="mb-2 text-sm font-medium">{t("tags")}</div>
              <div className="flex flex-wrap gap-2">
                {news.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialogEditTitle")}</DialogTitle>
            <DialogDescription>{t("dialogEditDescription")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 px-6 pb-2">
            <div className="grid gap-2">
              <Label htmlFor="news-edit-title">{tCommon("fieldTitle")}</Label>
              <Input
                id="news-edit-title"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="news-edit-subtitle">{tCommon("fieldSubtitle")}</Label>
              <Input
                id="news-edit-subtitle"
                value={form.subtitle}
                onChange={(e) => setForm((s) => ({ ...s, subtitle: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="news-edit-description">{tCommon("fieldDescription")}</Label>
              <Textarea
                id="news-edit-description"
                value={form.description}
                onChange={(e) =>
                  setForm((s) => ({ ...s, description: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="news-edit-subDescription">{tCommon("fieldSubDescription")}</Label>
              <Textarea
                id="news-edit-subDescription"
                value={form.subDescription}
                onChange={(e) =>
                  setForm((s) => ({ ...s, subDescription: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="news-edit-tags">{tCommon("fieldTags")}</Label>
              <Input
                id="news-edit-tags"
                placeholder={tCommon("fieldTagsPlaceholder")}
                value={form.tags}
                onChange={(e) => setForm((s) => ({ ...s, tags: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="news-edit-date">{tCommon("fieldDate")}</Label>
              <Input
                id="news-edit-date"
                type="datetime-local"
                value={form.date}
                onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="news-edit-isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="news-edit-isActive">{tCommon("fieldIsActive")}</Label>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="news-edit-image">{tCommon("fieldImage")}</Label>
              <Input
                id="news-edit-image"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
              <div className="text-xs text-muted-foreground">
                {t("imageOptionalHint")}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={submitting}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void onUpdate()}
              disabled={submitting || !form.title.trim()}
              className="gap-2"
            >
              {t("update")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

