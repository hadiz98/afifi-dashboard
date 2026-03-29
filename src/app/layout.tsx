import type { ReactNode } from "react";
import "./globals.css";
import {
  Geist,
  Geist_Mono,
  Noto_Sans_Arabic,
  Nunito_Sans,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";

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

const notoArabic = Noto_Serif_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const fontVariables = `${nunitoSans.variable} ${geistSans.variable} ${geistMono.variable} ${notoArabic.variable}`;

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
