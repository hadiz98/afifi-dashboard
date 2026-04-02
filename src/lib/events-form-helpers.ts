import type { EventLocale } from "@/lib/events-api";
import {
  FULL_CONTENT_MAX_LENGTH,
  META_DESCRIPTION_MAX_LENGTH,
  META_TITLE_MAX_LENGTH,
} from "@/lib/full-content-constants";

export type EventLocaleFormRow = {
  title: string;
  subtitle: string;
  fullContent: string;
  metaTitle: string;
  metaDescription: string;
};

export function hasBothEventLocalesComplete(
  tr: Record<EventLocale, Pick<EventLocaleFormRow, "title" | "subtitle" | "fullContent">>
): boolean {
  return (["en", "ar"] as const).every((loc) => {
    const v = tr[loc];
    return (
      v.title.trim().length > 0 &&
      v.subtitle.trim().length > 0 &&
      v.fullContent.trim().length > 0
    );
  });
}

export function buildEventTranslationsPayload(tr: Record<EventLocale, EventLocaleFormRow>) {
  const row = (loc: EventLocale) => {
    const v = tr[loc];
    const mt = v.metaTitle.trim().slice(0, META_TITLE_MAX_LENGTH);
    const md = v.metaDescription.trim().slice(0, META_DESCRIPTION_MAX_LENGTH);
    return {
      title: v.title.trim(),
      subtitle: v.subtitle.trim(),
      fullContent: v.fullContent.trim(),
      metaTitle: mt.length ? mt : null,
      metaDescription: md.length ? md : null,
    };
  };
  return { en: row("en"), ar: row("ar") };
}

export function anyEventFullContentOverLimit(tr: Record<EventLocale, EventLocaleFormRow>): boolean {
  return (["en", "ar"] as const).some((loc) => tr[loc].fullContent.length > FULL_CONTENT_MAX_LENGTH);
}
