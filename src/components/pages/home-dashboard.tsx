"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { RoleBadge } from "@/components/role-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthUser } from "@/hooks/use-auth-user";
import { cn } from "@/lib/utils";

export function HomeDashboard() {
  const t = useTranslations("HomePage");
  const { displayName, email, roles, isStaff, ready } = useAuthUser();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("welcomeCardTitle")}</CardTitle>
          <CardDescription>{t("welcomeCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{displayName || email || t("guest")}</p>
            {email ? (
              <p className="text-sm text-muted-foreground">{email}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roles.length > 0 ? (
                roles.map((r) => <RoleBadge key={r} role={r} />)
              ) : (
                <RoleBadge role="user" />
              )}
            </div>
          </div>
          <Button asChild>
            <Link href="/profile">
              {t("cta")}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("cardProfileTitle")}</CardTitle>
            <CardDescription>{t("cardProfileDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" size="sm">
              <Link href="/profile">{t("cardProfileAction")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("cardSecurityTitle")}</CardTitle>
            <CardDescription>{t("cardSecurityDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/password">{t("cardPasswordAction")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sessions">{t("cardSessionsAction")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card
          className={cn(
            "sm:col-span-2 lg:col-span-1",
            !ready || !isStaff ? "opacity-90" : undefined
          )}
        >
          <CardHeader>
            <CardTitle>{t("cardStaffTitle")}</CardTitle>
            <CardDescription>
              {ready && isStaff
                ? t("cardStaffDescription")
                : t("cardStaffLocked")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {ready && isStaff ? (
              <>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/users">{t("cardUsersAction")}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/roles">{t("cardRolesAction")}</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("cardStaffHint")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
