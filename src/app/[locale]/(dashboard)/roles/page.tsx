import { StaffGuard } from "@/components/dashboard/staff-guard";
import { RolesPanel } from "@/components/pages/roles-panel";

export default function RolesPage() {
  return (
    <StaffGuard>
      <RolesPanel />
    </StaffGuard>
  );
}
