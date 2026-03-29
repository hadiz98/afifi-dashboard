import { StaffGuard } from "@/components/dashboard/staff-guard";
import { UsersPanel } from "@/components/pages/users-panel";

export default function UsersPage() {
  return (
    <StaffGuard>
      <UsersPanel />
    </StaffGuard>
  );
}
