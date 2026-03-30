import { NewsDetailsPanel } from "@/components/pages/news-details-panel";

export default async function NewsDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NewsDetailsPanel id={id} />;
}

