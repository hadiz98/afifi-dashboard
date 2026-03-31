import { StaffGuard } from "@/components/dashboard/staff-guard";
import { HorseDetailsPanel } from "@/components/pages/horse-details-panel";

export default async function HorseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <StaffGuard>
      <HorseDetailsPanel id={id} />
    </StaffGuard>
  );
}

