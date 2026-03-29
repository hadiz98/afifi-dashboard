import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

const locales = routing.locales as readonly string[];

function getPathnameWithoutLocale(pathname: string): {
  locale: string;
  pathname: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];
  if (first && locales.includes(first)) {
    const rest = segments.slice(1);
    return {
      locale: first,
      pathname: rest.length > 0 ? `/${rest.join("/")}` : "/",
    };
  }
  const tail = segments.length > 0 ? `/${segments.join("/")}` : "/";
  return { locale: routing.defaultLocale, pathname: tail };
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { locale, pathname: path } = getPathnameWithoutLocale(pathname);

  const isLogin = path === "/login" || path.startsWith("/login/");
  const hasSession = request.cookies.get("afifi_session")?.value === "1";

  if (!isLogin && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  if (isLogin && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: [
    "/((?!api|_next|_vercel|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
