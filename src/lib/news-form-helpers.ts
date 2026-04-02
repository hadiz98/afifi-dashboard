import type { NewsLocale } from "@/lib/news-api";
import {
  FULL_CONTENT_MAX_LENGTH,
  META_DESCRIPTION_MAX_LENGTH,
  META_TITLE_MAX_LENGTH,
} from "@/lib/full-content-constants";

export type NewsLocaleFormRow = {
  title: string;
  subtitle: string;
  fullContent: string;
  metaTitle: string;
  metaDescription: string;
};

export function parseCommaTags(input: string): string[] {
  return input.split(",").map((s) => s.trim()).filter(Boolean);
}

export function isNewsLocaleComplete(
  row: Pick<NewsLocaleFormRow, "title" | "fullContent">,
  tagsComma: string
): boolean {
  return (
    row.title.trim().length > 0 &&
    row.fullContent.trim().length > 0 &&
    parseCommaTags(tagsComma).length > 0
  );
}

export function hasAtLeastOneNewsLocale(
  translations: Record<NewsLocale, Pick<NewsLocaleFormRow, "title" | "fullContent">>,
  tagsByLocale: Record<NewsLocale, string>
): boolean {
  return (["en", "ar"] as const).some((loc) =>
    isNewsLocaleComplete(translations[loc], tagsByLocale[loc])
  );
}

export function buildNewsTranslationsPayload(
  translations: Record<NewsLocale, NewsLocaleFormRow>,
  tagsByLocale: Record<NewsLocale, string>
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const loc of ["en", "ar"] as const) {
    const tt = translations[loc];
    if (!isNewsLocaleComplete(tt, tagsByLocale[loc])) continue;
    const tags = parseCommaTags(tagsByLocale[loc]);
    const mt = tt.metaTitle.trim().slice(0, META_TITLE_MAX_LENGTH);
    const md = tt.metaDescription.trim().slice(0, META_DESCRIPTION_MAX_LENGTH);
    payload[loc] = {
      title: tt.title.trim(),
      subtitle: tt.subtitle.trim(),
      fullContent: tt.fullContent.trim(),
      tags,
      metaTitle: mt.length ? mt : null,
      metaDescription: md.length ? md : null,
    };
  }
  return payload;
}

export function anyNewsFullContentOverLimit(
  translations: Record<NewsLocale, NewsLocaleFormRow>
): boolean {
  return (["en", "ar"] as const).some(
    (loc) => translations[loc].fullContent.length > FULL_CONTENT_MAX_LENGTH
  );
}
