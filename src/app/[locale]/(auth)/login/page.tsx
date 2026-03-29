import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "ar" ? "تسجيل الدخول" : "Sign in",
  };
}

export default function LoginPage() {
  return <LoginForm />;
}
