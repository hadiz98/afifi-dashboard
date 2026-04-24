"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/use-auth-user";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProxyResponse = {
  ok?: boolean;
  revalidated?: string[];
  error?: string;
};

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/$/, "");
}

export function InvalidateLandingCacheButton() {
  const t = useTranslations("CacheActions");
  const { isStaff, ready } = useAuthUser();
  const [submitting, setSubmitting] = useState(false);

  if (!ready || !isStaff) return null;

  async function onInvalidateAll() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const landingBase = normalizeBaseUrl(process.env.NEXT_PUBLIC_LANDING_BASE_URL);
      if (!landingBase) {
        toast.error("Missing NEXT_PUBLIC_LANDING_BASE_URL");
        return;
      }

      const url = `${landingBase}/api/revalidate`;
      const publicSecret = (process.env.NEXT_PUBLIC_LANDING_REVALIDATE_SECRET ?? "").trim();

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(publicSecret ? { "x-revalidate-secret": publicSecret } : {}),
        },
        body: JSON.stringify({}),
      });

      let body: ProxyResponse | null = null;
      try {
        body = (await res.json()) as ProxyResponse;
      } catch {
        body = null;
      }

      if (!res.ok || body?.ok === false) {
        toast.error(body?.error || t("error"));
        return;
      }

      const count = Array.isArray(body?.revalidated) ? body.revalidated.length : 0;
      toast.success(t("success", { count }));
    } catch {
      toast.error(t("networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 text-xs"
      disabled={submitting}
      onClick={() => void onInvalidateAll()}
      aria-label={submitting ? t("loading") : t("button")}
    >
      <RefreshCw className={cn("size-3.5", submitting && "animate-spin")} />
      {submitting ? t("loading") : t("button")}
    </Button>
  );
}
