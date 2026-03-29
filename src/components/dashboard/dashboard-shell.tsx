"use client";

import type { ReactNode } from "react";
import { useLocale } from "next-intl";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const contentDir = locale === "ar" ? "rtl" : "ltr";

  return (
    <SidebarProvider defaultOpen className="flex-row-reverse" dir="ltr">
      <AppSidebar />
      <SidebarInset
        dir={contentDir}
        className="flex min-h-svh min-w-0 flex-1 flex-col bg-muted/25"
      >
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:px-5">
          <SidebarTrigger />
          <ThemeToggle />
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
