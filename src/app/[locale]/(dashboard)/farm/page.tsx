import { StaffGuard } from "@/components/dashboard/staff-guard";
import { FarmPanel } from "@/components/pages/farm-panel";

export default function FarmAdminPage() {
  return (
    <StaffGuard>
      <FarmPanel />
    </StaffGuard>
  );
}

