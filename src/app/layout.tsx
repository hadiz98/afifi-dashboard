import type { ReactNode } from "react";
import "./globals.css";

/** Pass-through root; document shell and i18n live in `[locale]/layout.tsx`. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
