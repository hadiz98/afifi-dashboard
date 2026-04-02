import { StaffGuard } from "@/components/dashboard/staff-guard";
import { PagesPanel } from "@/components/pages/pages-panel";

export default function PagesAdmin() {
  return (
    <StaffGuard>
      <PagesPanel />
    </StaffGuard>
  );
}

