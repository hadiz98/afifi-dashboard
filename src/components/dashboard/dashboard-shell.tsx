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
  const isRtl = locale === "ar";
  const dir = isRtl ? "rtl" : "ltr";

  return (
    <div dir={dir} className="contents">
      <SidebarProvider
        defaultOpen
      // DO NOT use flex-row-reverse — it breaks sticky header stacking context.
      // Instead we rely on `dir` on the root element to flip the sidebar
      // naturally via the browser's BiDi layout engine.
      >
        <AppSidebar />

        <SidebarInset className="flex min-h-svh min-w-0 flex-1 flex-col bg-muted/25">
          <header
            // `start-0` maps to `left: 0` in LTR and `right: 0` in RTL —
            // always hugs the inset edge regardless of direction.
            className="sticky top-0 z-10 flex h-14 w-full shrink-0 items-center border-b border-border/80 bg-background/90 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 md:px-5"
          >
            {/* Trigger always on the leading edge */}
            <SidebarTrigger className="shrink-0" />

            {/* Spacer pushes ThemeToggle to the trailing edge */}
            <div className="flex-1" />

            <ThemeToggle />
          </header>

          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}