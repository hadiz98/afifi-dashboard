import { StaffGuard } from "@/components/dashboard/staff-guard";
import { EventsPanel } from "@/components/pages/events-panel";

export default function EventsPage() {
  return (
    <StaffGuard>
      <EventsPanel />
    </StaffGuard>
  );
}

