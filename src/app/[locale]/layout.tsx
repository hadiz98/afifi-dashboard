import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Sans_Arabic,
  Nunito_Sans,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Providers } from "@/components/providers";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-nunito-sans",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "ar" ? "لوحة تحكم عفيفي" : "Afifi Dashboard",
    icons: {
      icon: [
        {
          url: "/logo200x80.png",
          type: "image/png",
          sizes: "200x80",
        },
      ],
      shortcut: [
        {
          url: "/logo200x80.png",
          type: "image/png",
          sizes: "200x80",
        },
      ],
      apple: [
        {
          url: "/logo200x80.png",
          type: "image/png",
          sizes: "200x80",
        },
      ],
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  const isArabic = locale === "ar";
  const fontVariables = cn(
    nunitoSans.variable,
    geistSans.variable,
    geistMono.variable,
    notoArabic.variable
  );

  return (
    <html
      lang={locale}
      dir={isArabic ? "rtl" : "ltr"}
      className={cn("h-full antialiased", fontVariables)}
      suppressHydrationWarning
    >
      <body
        className={cn(
          "flex min-h-svh bg-background text-foreground font-sans",
          isArabic && "[font-family:var(--font-noto-arabic),var(--font-geist-sans),system-ui,sans-serif]"
        )}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}