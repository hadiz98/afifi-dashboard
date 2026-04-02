"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe, Image as ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { toastApiError } from "@/lib/toast-api-error";
import { fetchPublicPage, type PageKey, type PublicPageResponse } from "@/lib/pages-api";
import { Skeleton } from "@/components/ui/skeleton";

export function DynamicLandingPage({ pageKey }: { pageKey: PageKey }) {
  const t = useTranslations("LandingPage");
  const locale = useLocale();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<PublicPageResponse | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPublicPage({ key: pageKey, locale: locale === "ar" ? "ar" : "en" })
      .then((p) => {
        if (!alive) return;
        setItem(p);
      })
      .catch((e) => {
        if (!alive) return;
        // Public endpoint returns 404 when missing/inactive; treat as empty.
        toastApiError(e, t("loadError"));
        setItem(null);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [locale, pageKey, t]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 px-3 py-6 sm:px-6">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 px-3 py-10 text-center sm:px-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border/60 bg-muted/30">
          <Globe className="size-5 text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground">{t("missingTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("missingHint")}</p>
      </div>
    );
  }

  const tr = item.translation;
  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-3 py-6 sm:px-6">
      <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        <div className="relative aspect-[21/9] max-h-72 bg-muted sm:aspect-auto sm:h-64">
          {item.coverImage ? (
            <img
              src={item.coverImage}
              alt={tr.title}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="size-10 text-muted-foreground/20" />
            </div>
          )}
        </div>
        <div className="border-t border-border/60 px-4 py-4 sm:px-6">
          <h1 className={cn("text-xl font-bold tracking-tight text-foreground", locale === "ar" && "text-right")}>
            {tr.title}
          </h1>
          {tr.subtitle?.trim() ? (
            <p className={cn("mt-1 text-sm text-muted-foreground", locale === "ar" && "text-right")}>
              {tr.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      <div className={cn("rounded-2xl border border-border/60 bg-card p-4 sm:p-6", locale === "ar" && "text-right")}>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{tr.text}</p>
      </div>
    </div>
  );
}

