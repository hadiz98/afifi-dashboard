"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clearAuthSession } from "@/lib/auth-session";
import { cn } from "@/lib/utils";

export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("Common");
  const router = useRouter();

  function signOut() {
    clearAuthSession();
    router.replace("/login");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(className)}
      onClick={signOut}
    >
      {t("signOut")}
    </Button>
  );
}
