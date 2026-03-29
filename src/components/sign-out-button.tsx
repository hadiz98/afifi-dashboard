"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { clearAuthSession } from "@/lib/auth-session";

export function SignOutButton() {
  const t = useTranslations("HomePage");
  const router = useRouter();

  function signOut() {
    clearAuthSession();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={signOut}>
      {t("signOut")}
    </Button>
  );
}
