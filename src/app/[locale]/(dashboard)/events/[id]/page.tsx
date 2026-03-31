import { StaffGuard } from "@/components/dashboard/staff-guard";
import { EventDetailsPanel } from "@/components/pages/event-details-panel";

export default async function EventDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <StaffGuard>
      <EventDetailsPanel id={id} />
    </StaffGuard>
  );
}

