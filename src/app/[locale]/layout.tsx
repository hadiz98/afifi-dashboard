import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/providers";

const locales = routing.locales as readonly string[];

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
    title: locale === "ar" ? "لوحة تحكم عفيفي" : "Afifi dashboard",
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!locales.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const fontVariables = `${geistSans.variable} ${geistMono.variable} ${notoArabic.variable}`;

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${fontVariables} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className={
          locale === "ar"
            ? "flex min-h-full flex-col bg-background font-sans text-foreground [font-family:var(--font-noto-arabic),var(--font-geist-sans),system-ui,sans-serif]"
            : "flex min-h-full flex-col bg-background font-sans text-foreground"
        }
      >
        {/* Blocking theme init (avoids FOUC). Not a client-component script. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{var k='theme',d=document.documentElement,t=localStorage.getItem(k),rm=function(){d.classList.remove('light','dark')};if(t==='dark'||t==='light'){rm();d.classList.add(t);d.style.colorScheme=t}else{var m=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';rm();d.classList.add(m);d.style.colorScheme=m}}catch(e){}})();`,
          }}
        />
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
