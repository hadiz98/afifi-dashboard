import { StaffGuard } from "@/components/dashboard/staff-guard";
import { VideosPanel } from "@/components/pages/videos-panel";

export default function VideosPage() {
  return (
    <StaffGuard>
      <VideosPanel />
    </StaffGuard>
  );
}
