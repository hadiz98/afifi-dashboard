import type { ReactNode } from "react";
import "./globals.css";
import { Nunito_Sans } from "next/font/google";

const nunitoSans = Nunito_Sans({subsets:['latin'],variable:'--font-sans'});


export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
