import { StaffGuard } from "@/components/dashboard/staff-guard";
import { HorsesPanel } from "@/components/pages/horses-panel";

export default function HorsesPage() {
  return (
    <StaffGuard>
      <HorsesPanel />
    </StaffGuard>
  );
}

