"use client";

import { useLocale, useTranslations } from "next-intl";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function setDatePart(base: Date | null, nextDate: Date): Date {
  const d = new Date(nextDate);
  if (base) {
    d.setHours(base.getHours(), base.getMinutes(), 0, 0);
  } else {
    d.setHours(12, 0, 0, 0);
  }
  return d;
}

function setTimePart(base: Date | null, time: string): Date | null {
  if (!base) return null;
  const [hh, mm] = time.split(":");
  const h = Number.parseInt(hh ?? "", 10);
  const m = Number.parseInt(mm ?? "", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return base;
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function toTimeValue(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NewsDateTimePicker({
  value,
  onChange,
  error,
  className,
  required,
}: {
  value: Date | null;
  onChange: (next: Date | null) => void;
  error?: string;
  className?: string;
  required?: boolean;
}) {
  const t = useTranslations("NewsPage");
  const locale = useLocale();

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="flex items-center gap-1.5">
        <CalendarIcon className="size-3 text-muted-foreground" />
        {t("fieldDate")}
        {required ? <span className="text-destructive">*</span> : null}
      </Label>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn(
                "h-8 w-full justify-between px-2 text-sm font-normal",
                !value && "text-muted-foreground"
              )}
            >
              <span className="truncate">
                {value
                  ? new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(value)
                  : t("pickDate")}
              </span>
              <CalendarIcon className="size-4 opacity-60" aria-hidden />
            </Button>
          }
        />
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-2">
            <Calendar
              mode="single"
              selected={value ?? undefined}
              onSelect={(d) => {
                if (!d) onChange(null);
                else onChange(setDatePart(value, d));
              }}
              captionLayout="dropdown"
              fromYear={2000}
              toYear={new Date().getFullYear() + 5}
              initialFocus
            />
            <div className="mt-2 grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("fieldTime")}
              </Label>
              <Input
                type="time"
                value={toTimeValue(value)}
                onChange={(e) => onChange(setTimePart(value, e.target.value))}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

