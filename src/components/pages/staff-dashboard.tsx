"use client";

import {
  CalendarClock,
  CheckCircle2,
  Mail,
  Newspaper,
  RefreshCw,
  ShieldAlert,
  Users,
  ChessKnight,
  LayoutDashboard,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { toastApiError } from "@/lib/toast-api-error";
import { ApiError } from "@/lib/api-error";
import {
  fetchDashboardSummary,
  type DashboardLocale,
  type DashboardSummary,
} from "@/lib/dashboard-api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string | null | undefined, locale: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(d);
  } catch {
    return iso;
  }
}

function pickNewsTitle(
  row: DashboardSummary["news"]["recent"][number],
  locale: string
): { title: string; subtitle: string } {
  const want = locale === "ar" ? "ar" : "en";
  const exact = row.translations?.find((t) => t.locale === want);
  const fallback =
    row.translations?.find((t) => t.locale === "en") ?? row.translations?.[0];
  const tr = exact ?? fallback ?? null;
  return {
    title: tr?.title?.trim() ? tr.title : "—",
    subtitle: tr?.subtitle ?? "",
  };
}

function StatBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  badge,
  actionHref,
  actionLabel,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  badge?: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background shadow-sm">
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              {badge}
            </div>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actionHref && actionLabel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            nativeButton={false}
            render={<Link href={actionHref}>{actionLabel}</Link>}
          />
        ) : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function KpiTile({
  href,
  icon: Icon,
  label,
  value,
  sub,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-colors hover:bg-muted/20"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background shadow-sm">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p className="mt-1 truncate text-lg font-bold tracking-tight text-foreground">
          {value}
        </p>
        {sub ? (
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            {sub}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function StaffDashboard({
  onForbidden,
}: {
  onForbidden?: () => void;
}) {
  const t = useTranslations("StaffDashboard");
  const tNews = useTranslations("NewsPage");
  const tEvents = useTranslations("EventsPage");
  const tHorses = useTranslations("HorsesPage");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setInlineError(null);
    try {
      const summary = await fetchDashboardSummary(locale as DashboardLocale);
      setData(summary);
    } catch (e) {
      if (e instanceof ApiError && e.statusCode === 403) {
        onForbidden?.();
        setData(null);
        setInlineError(null);
        return;
      }
      toastApiError(e, t("loadError"));
      setData(null);
      setInlineError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [locale, onForbidden, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = useMemo(() => {
    if (!data) return null;
    return {
      news: data.news,
      horses: data.horses,
      events: data.events,
      newsletter: data.newsletter,
    };
  }, [data]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-3 py-5 sm:px-6 sm:py-8">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-card shadow-sm">
            <LayoutDashboard className="size-4 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {inlineError ? (
            <StatBadge>{t("errorBadge")}</StatBadge>
          ) : (
            <StatBadge>{loading ? "…" : t("liveBadge")}</StatBadge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={loading}
            onClick={() => void load()}
            aria-label={t("refresh")}
          >
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* ── Inline error ───────────────────────────────────────────────────── */}
      {inlineError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl border border-destructive/30 bg-background">
              <ShieldAlert className="size-4 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{t("errorTitle")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{inlineError}</p>
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => void load()}
                >
                  <RefreshCw className="size-3.5" />
                  {t("retry")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── KPI grid ───────────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
              <Skeleton className="mt-3 h-4 w-28" />
            </div>
          ))
        ) : kpis ? (
          <>
            <KpiTile
              href="/news"
              icon={Newspaper}
              label={t("kpiNews")}
              value={kpis.news.total}
              sub={
                <>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                    {t("active")}: {kpis.news.active}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <XCircle className="size-3" />
                    {t("inactive")}: {kpis.news.inactive}
                  </span>
                </>
              }
            />
            <KpiTile
              href="/horses"
              icon={ChessKnight}
              label={t("kpiHorses")}
              value={kpis.horses.total}
              sub={
                <>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                    {t("active")}: {kpis.horses.active}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <XCircle className="size-3" />
                    {t("inactive")}: {kpis.horses.inactive}
                  </span>
                </>
              }
            />
            <KpiTile
              href="/events"
              icon={CalendarClock}
              label={t("kpiEvents")}
              value={kpis.events.total}
              sub={
                <>
                  <span className="inline-flex items-center gap-1">
                    {t("upcoming")}: {kpis.events.upcoming}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {t("today")}: {kpis.events.today}
                  </span>
                </>
              }
            />
            <KpiTile
              href="/newsletter"
              icon={Mail}
              label={t("kpiNewsletter")}
              value={kpis.newsletter.total}
            />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-8 text-center sm:col-span-2 lg:col-span-4">
            <p className="text-sm font-medium text-foreground">{t("empty")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("emptyHint")}</p>
          </div>
        )}
      </div>

      {/* ── Recent News ───────────────────────────────────────────────────── */}
      <Section
        icon={Newspaper}
        title={t("recentNewsTitle")}
        description={t("recentNewsDescription")}
        badge={<StatBadge>{loading ? "…" : data?.news.recent.length ?? 0}</StatBadge>}
        actionHref="/news"
        actionLabel={t("viewAll")}
      >
        {loading ? (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-16 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : (data?.news.recent.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-10 text-center">
            <p className="text-sm font-medium text-foreground">{t("recentNewsEmpty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-background">
            {data!.news.recent.map((row) => {
              const { title, subtitle } = pickNewsTitle(row, locale);
              return (
                <Link
                  key={row.id}
                  href={`/news/${encodeURIComponent(row.id)}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
                >
                  <div className="h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                    {row.image ? (
                      <img src={row.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Newspaper className="size-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {subtitle || formatDateOnly(row.date ?? null, locale)}
                    </p>
                  </div>
                  {row.isActive !== false ? (
                    <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 sm:inline-flex">
                      <CheckCircle2 className="size-3" />
                      {tNews("statusActive")}
                    </span>
                  ) : (
                    <span className="hidden items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                      <XCircle className="size-3" />
                      {tNews("statusInactive")}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Recent Horses ─────────────────────────────────────────────────── */}
      <Section
        icon={ChessKnight}
        title={t("recentHorsesTitle")}
        description={t("recentHorsesDescription")}
        badge={
          <div className="flex flex-wrap items-center gap-1.5">
            <StatBadge>{loading ? "…" : data?.horses.recent.length ?? 0}</StatBadge>
            {!loading && data ? (
              <>
                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {tHorses("category.stallion")}: {data.horses.byCategory.stallion}
                </span>
                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {tHorses("category.mare")}: {data.horses.byCategory.mare}
                </span>
                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {tHorses("category.filly")}: {data.horses.byCategory.filly}
                </span>
                <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {tHorses("category.colt")}: {data.horses.byCategory.colt}
                </span>
              </>
            ) : null}
          </div>
        }
        actionHref="/horses"
        actionLabel={t("viewAll")}
      >
        {loading ? (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-16 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : (data?.horses.recent.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-10 text-center">
            <p className="text-sm font-medium text-foreground">{t("recentHorsesEmpty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-background">
            {data!.horses.recent.map((row) => (
              <Link
                key={row.id}
                href={`/horses/${encodeURIComponent(row.id)}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
              >
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                  {row.coverImage ? (
                    <img src={row.coverImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ChessKnight className="size-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{row.slug}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.updatedAt ? formatDateTime(row.updatedAt, locale) : "—"}
                  </p>
                </div>
                <span className="hidden items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                  {tHorses(`category.${row.category}`)}
                </span>
                {row.isActive !== false ? (
                  <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 sm:inline-flex">
                    <CheckCircle2 className="size-3" />
                    {tHorses("active")}
                  </span>
                ) : (
                  <span className="hidden items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                    <XCircle className="size-3" />
                    {tHorses("inactive")}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* ── Upcoming Events ───────────────────────────────────────────────── */}
      <Section
        icon={CalendarClock}
        title={t("upcomingEventsTitle")}
        description={t("upcomingEventsDescription")}
        badge={
          <div className="flex flex-wrap items-center gap-1.5">
            <StatBadge>{loading ? "…" : data?.events.upcomingList.length ?? 0}</StatBadge>
            {!loading && data ? (
              <>
                <StatBadge>{t("upcoming")}: {data.events.upcoming}</StatBadge>
                <StatBadge>{t("today")}: {data.events.today}</StatBadge>
              </>
            ) : null}
          </div>
        }
        actionHref="/events"
        actionLabel={t("viewAll")}
      >
        {loading ? (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-10 w-16 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : (data?.events.upcomingList.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-10 text-center">
            <p className="text-sm font-medium text-foreground">{t("upcomingEventsEmpty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-background">
            {data!.events.upcomingList.map((row) => (
              <Link
                key={row.id}
                href={`/events/${encodeURIComponent(row.id)}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20"
              >
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
                  {row.image ? (
                    <img src={row.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <CalendarClock className="size-4 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {row.translation?.title?.trim() ? row.translation.title : row.slug}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(row.startsAt, locale)}
                    {row.endsAt ? ` → ${formatDateTime(row.endsAt, locale)}` : ""}
                  </p>
                </div>
                {row.isActive !== false ? (
                  <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 sm:inline-flex">
                    <CheckCircle2 className="size-3" />
                    {tEvents("active")}
                  </span>
                ) : (
                  <span className="hidden items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
                    <XCircle className="size-3" />
                    {tEvents("inactive")}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* ── Newsletter ────────────────────────────────────────────────────── */}
      <Section
        icon={Users}
        title={t("recentSubscribersTitle")}
        description={t("recentSubscribersDescription")}
        badge={<StatBadge>{loading ? "…" : data?.newsletter.recent.length ?? 0}</StatBadge>}
        actionHref="/newsletter"
        actionLabel={t("viewAll")}
      >
        {loading ? (
          <div className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-4 w-56" />
                <Skeleton className="ms-auto h-4 w-28" />
              </div>
            ))}
          </div>
        ) : (data?.newsletter.recent.length ?? 0) === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/10 p-10 text-center">
            <p className="text-sm font-medium text-foreground">{t("recentSubscribersEmpty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-background">
            {data!.newsletter.recent.map((row) => (
              <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {row.fullName?.trim() ? row.fullName : row.email}
                  </p>
                  {row.fullName?.trim() ? (
                    <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  ) : null}
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {row.createdAt ? formatDateTime(row.createdAt, locale) : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

