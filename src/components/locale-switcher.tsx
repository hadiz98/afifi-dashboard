"use client";

import { CheckIcon, ChevronDownIcon, LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
  className?: string;
  variant?: "default" | "compact" | "sidebar" | "sidebarIcon";
};

export function LocaleSwitcher({
  className,
  variant = "default",
}: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("LocaleSwitcher");

  const compact = variant === "compact";
  const sidebar = variant === "sidebar";
  const sidebarIcon = variant === "sidebarIcon";

  function switchLocale(next: string) {
    if (next === locale) return;
    router.replace(pathname, { locale: next });
  }

  const currentLabel = locale === "en" ? t("en") : t("ar");

  const trigger = sidebarIcon ? (
    <DropdownMenuTrigger
      type="button"
      aria-label={`${t("label")}: ${currentLabel}`}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground outline-none transition-colors",
        "hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
    >
      <LanguagesIcon className="size-4 opacity-80" aria-hidden />
    </DropdownMenuTrigger>
  ) : (
    <DropdownMenuTrigger
      type="button"
      aria-label={t("label")}
      className={cn(
        "inline-flex w-full items-center justify-between gap-2 rounded-md border text-start text-sm font-medium shadow-xs outline-none transition-[color,box-shadow,background-color]",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        compact
          ? "h-8 max-w-[11rem] min-w-[8.5rem] px-2.5 text-xs"
          : "h-9 px-3",
        sidebar
          ? "border-sidebar-border bg-sidebar-accent/45 text-sidebar-foreground hover:bg-sidebar-accent"
          : "border-border bg-background hover:bg-muted/60",
        className
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <LanguagesIcon
          className="size-4 shrink-0 opacity-70"
          aria-hidden
        />
        <span className="truncate">{currentLabel}</span>
      </span>
      <ChevronDownIcon
        className="size-4 shrink-0 opacity-60 rtl:rotate-180"
        aria-hidden
      />
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {trigger}
      <DropdownMenuContent
        align="start"
        className={cn(
          "min-w-[var(--anchor-width)] sm:min-w-44",
          (sidebar || sidebarIcon) && "border-sidebar-border bg-popover"
        )}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("label")}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {routing.locales.map((loc) => {
            const selected = loc === locale;
            return (
              <DropdownMenuItem
                key={loc}
                onClick={() => switchLocale(loc)}
                className={cn(
                  "cursor-pointer gap-3",
                  selected && "bg-accent/60"
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {loc === "en" ? t("en") : t("ar")}
                </span>
                <DropdownMenuShortcut className="opacity-80">
                  {loc === "en" ? t("enShort") : t("arShort")}
                </DropdownMenuShortcut>
                <CheckIcon
                  className={cn(
                    "size-4 shrink-0",
                    selected ? "text-primary opacity-100" : "opacity-0"
                  )}
                  aria-hidden
                />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
