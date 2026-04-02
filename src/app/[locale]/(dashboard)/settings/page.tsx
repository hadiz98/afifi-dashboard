import { StaffGuard } from "@/components/dashboard/staff-guard";
import { SettingsPanel } from "@/components/pages/settings-panel";

export default function SettingsPage() {
  return (
    <StaffGuard>
      <SettingsPanel />
    </StaffGuard>
  );
}

