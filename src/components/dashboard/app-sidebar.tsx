"use client";

import type { LucideIcon } from "lucide-react";
import {
  Home,
  KeyRound,
  MonitorSmartphone,
  Shield,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { RoleBadge } from "@/components/role-badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuthUser } from "@/hooks/use-auth-user";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

function NavSection({
  items,
  isActive,
}: {
  items: readonly NavItem[];
  isActive: (href: string) => boolean;
}) {
  return (
    <SidebarMenu>
      {items.map(({ href, label, icon: Icon }) => (
        <SidebarMenuItem key={href}>
          <SidebarMenuButton asChild isActive={isActive(href)} tooltip={label}>
            <Link href={href}>
              <Icon className="size-4 shrink-0" />
              <span>{label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

export function AppSidebar() {
  const locale = useLocale();
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const { roles, displayName, email, isStaff, ready } = useAuthUser();

  const mainItems: readonly NavItem[] = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/profile", label: t("profile"), icon: User },
    { href: "/password", label: t("password"), icon: KeyRound },
    { href: "/sessions", label: t("sessions"), icon: MonitorSmartphone },
  ];

  const staffItems: readonly NavItem[] = [
    { href: "/users", label: t("users"), icon: Users },
    { href: "/roles", label: t("roles"), icon: Shield },
  ];

  function navActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <Sidebar
      side="right"
      collapsible="icon"
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="border-s border-sidebar-border"
    >
      <SidebarHeader className="gap-4 border-b border-sidebar-border px-2 py-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-sidebar-border bg-background shadow-sm">
            <Image
              src="/logo200x80.png"
              alt=""
              width={200}
              height={80}
              className="h-8 w-auto max-w-[4.75rem] object-contain dark:brightness-110"
              priority
            />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
              {t("brand")}
            </p>
            <p className="text-xs font-medium text-sidebar-foreground/60">
              {t("productTagline")}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-sidebar-border/70 pt-3 group-data-[collapsible=icon]:hidden">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {displayName || email || "—"}
          </p>
          {email ? (
            <p className="truncate text-xs text-sidebar-foreground/65">
              {email}
            </p>
          ) : null}
          {roles.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {roles.map((r) => (
                <RoleBadge key={r} role={r} />
              ))}
            </div>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel>{t("sectionMain")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <NavSection items={mainItems} isActive={navActive} />
          </SidebarGroupContent>
        </SidebarGroup>

        {ready && isStaff ? (
          <>
            <SidebarSeparator className="mx-0 bg-sidebar-border/60" />
            <SidebarGroup className="p-0">
              <SidebarGroupLabel>{t("sectionStaff")}</SidebarGroupLabel>
              <SidebarGroupContent>
                <NavSection items={staffItems} isActive={navActive} />
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="gap-2 border-t border-sidebar-border px-2 py-3">
        <div className="group-data-[collapsible=icon]:hidden">
          <LocaleSwitcher
            variant="sidebar"
            className="w-full border-sidebar-border bg-sidebar-accent/40"
          />
        </div>
        <SignOutButton className="w-full" />
      </SidebarFooter>
    </Sidebar>
  );
}
