"use client";

import type { HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import {
  KeyRound,
  LayoutDashboard,
  LogOut,
  MonitorSmartphone,
  Newspaper,
  Shield,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { clearAuthSession } from "@/lib/auth-session";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuthUser } from "@/hooks/use-auth-user";
import { BRAND_MEDIA } from "@/lib/media-paths";

type NavLabelKey =
  | "home"
  | "profile"
  | "password"
  | "sessions"
  | "news"
  | "users"
  | "roles";

type NavDef = {
  href: string;
  labelKey: NavLabelKey;
  icon: LucideIcon;
  staffOnly?: true;
};

const allNavDefs: readonly NavDef[] = [
  { href: "/", labelKey: "home", icon: LayoutDashboard },
  { href: "/profile", labelKey: "profile", icon: User },
  { href: "/password", labelKey: "password", icon: KeyRound },
  { href: "/sessions", labelKey: "sessions", icon: MonitorSmartphone },
  { href: "/news", labelKey: "news", icon: Newspaper },
  { href: "/users", labelKey: "users", icon: Users, staffOnly: true },
  { href: "/roles", labelKey: "roles", icon: Shield, staffOnly: true },
] as const;

export function AppSidebar() {
  const locale = useLocale();
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const router = useRouter();
  const { state: sidebarState } = useSidebar();
  const { isStaff, ready } = useAuthUser();

  const navDefs = allNavDefs.filter(
    (item) => !item.staffOnly || (ready && isStaff)
  );

  function navActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleLogout() {
    clearAuthSession();
    router.replace("/login");
  }

  function renderSidebarBrandButton(props: HTMLAttributes<HTMLAnchorElement>) {
    return (
      <Link
        href="/"
        {...props}
        className={cn(
          "flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
          "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-2",
          props.className
        )}
      >
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden bg-transparent group-data-[collapsible=icon]:size-9 md:size-12">
          <Image
            src={BRAND_MEDIA.logo}
            alt=""
            width={BRAND_MEDIA.logoWidth}
            height={BRAND_MEDIA.logoHeight}
            className="h-full w-full object-contain dark:brightness-110"
            priority
          />
        </div>
        <div className="flex min-w-0 flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
          <span className="truncate text-sm font-semibold text-sidebar-foreground sm:text-base">
            {t("appName")}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {t("appTagline")}
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Sidebar
      side="right"
      collapsible="icon"
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="border-inline-start border-border"
    >
      <SidebarHeader className="border-b border-border px-3 py-4 sm:px-4 sm:py-5 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
        <SidebarMenu className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem className="group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              size="lg"
              tooltip={t("appName")}
              className="group-data-[collapsible=icon]:mx-auto"
              render={renderSidebarBrandButton}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="flex-1 overflow-hidden px-3 py-4 sm:px-4 sm:py-5 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <SidebarGroup>
          <SidebarGroupContent className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
            <SidebarMenu className="w-full gap-1.5 group-data-[collapsible=icon]:items-center">
              {navDefs.map(({ href, labelKey, icon: Icon }) => {
                const isActive = navActive(href);
                const label = t(labelKey);

                function renderSidebarNavButton(
                  props: HTMLAttributes<HTMLAnchorElement>
                ) {
                  return (
                    <Link
                      href={href}
                      {...props}
                      className={cn(
                        "flex w-full items-center gap-3 text-start",
                        "group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0",
                        props.className
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span className="truncate group-data-[collapsible=icon]:hidden">
                        {label}
                      </span>
                    </Link>
                  );
                }

                return (
                  <SidebarMenuItem
                    key={href}
                    className="mx-1.5 w-full group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center"
                  >
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={label}
                      className={cn(
                        "min-h-12 text-sm font-medium transition-all duration-200",
                        "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring",
                        "data-active:border-primary data-active:border-inline-start-2 data-active:bg-primary/10 data-active:text-primary",
                        "group-data-[collapsible=icon]:data-active:border-transparent group-data-[collapsible=icon]:data-active:border-inline-start-0",
                        "group-data-[collapsible=icon]:m-1 group-data-[collapsible=icon]:min-h-12 group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:p-2",
                        "group-data-[collapsible=icon]:data-active:rounded-lg"
                      )}
                      render={renderSidebarNavButton}
                    />
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="overflow-hidden border-t border-border px-3 py-4 sm:px-4 sm:py-5 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-3">
        <SidebarMenu className="w-full gap-2 group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem className="w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:justify-center">
            <div className="flex w-full justify-center px-0 group-data-[collapsible=icon]:w-auto">
              <LocaleSwitcher
                variant={
                  sidebarState === "collapsed" ? "sidebarIcon" : "sidebar"
                }
                className={
                  sidebarState === "collapsed"
                    ? undefined
                    : "w-full border-sidebar-border bg-sidebar-accent/40"
                }
              />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:justify-center">
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip={t("logout")}
              className="min-h-12 w-full gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:min-h-8 group-data-[collapsible=icon]:max-h-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              <span className="truncate group-data-[collapsible=icon]:hidden">
                {t("logout")}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
