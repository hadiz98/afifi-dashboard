import { StaffGuard } from "@/components/dashboard/staff-guard";
import { GalleryPanel } from "@/components/pages/gallery-panel";

export default function GalleryPage() {
  return (
    <StaffGuard>
      <GalleryPanel />
    </StaffGuard>
  );
}

