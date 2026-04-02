import { notFound } from "next/navigation";
import { DynamicLandingPage } from "@/components/landing/dynamic-landing-page";

const allowed = new Set(["home", "farm", "news", "events", "horses", "contact"]);

export default async function PublicPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!allowed.has(key)) notFound();
  return <DynamicLandingPage pageKey={key as any} />;
}

