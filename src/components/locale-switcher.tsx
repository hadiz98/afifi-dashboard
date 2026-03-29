"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useTransition } from "react";

type Props = {
  className?: string;
  variant?: "default" | "compact" | "sidebar";
};

export function LocaleSwitcher({
  className,
  variant = "default",
}: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("LocaleSwitcher");
  const [pending, startTransition] = useTransition();

  function switchLocale(next: string) {
    if (next === locale || pending) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  const compact = variant === "compact";
  const sidebar = variant === "sidebar";

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={cn(
        "flex w-full rounded-md border p-1",
        sidebar
          ? "border-sidebar-border bg-sidebar-accent/40"
          : "border-border bg-muted",
        compact ? "max-w-[200px]" : "",
        className
      )}
    >
      {routing.locales.map((loc) => {
        const active = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            disabled={pending}
            onClick={() => switchLocale(loc)}
            className={cn(
              "min-w-0 flex-1 rounded-sm px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
              !compact && "px-3 py-2 text-sm",
              active
                ? sidebar
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "bg-background text-foreground shadow-sm"
                : sidebar
                  ? "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  : "text-muted-foreground hover:bg-background/80 hover:text-foreground"
            )}
          >
            {loc === "en" ? t("enShort") : t("arShort")}
          </button>
        );
      })}
    </div>
  );
}
