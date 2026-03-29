"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/hooks/use-auth-user";

export function StaffGuard({ children }: { children: ReactNode }) {
  const t = useTranslations("StaffGuard");
  const router = useRouter();
  const { isStaff, ready } = useAuthUser();

  useEffect(() => {
    if (!ready) return;
    if (!isStaff) {
      router.replace("/");
    }
  }, [isStaff, ready, router]);

  if (!ready || !isStaff) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-64 w-full max-w-3xl rounded-lg" />
        <p className="text-sm text-muted-foreground">{t("redirecting")}</p>
      </div>
    );
  }

  return children;
}
