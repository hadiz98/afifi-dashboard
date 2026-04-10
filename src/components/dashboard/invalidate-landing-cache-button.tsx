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

export function InvalidateLandingCacheButton() {
  const t = useTranslations("CacheActions");
  const { isStaff, ready } = useAuthUser();
  const [submitting, setSubmitting] = useState(false);

  if (!ready || !isStaff) return null;

  async function onInvalidateAll() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/revalidate-landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
