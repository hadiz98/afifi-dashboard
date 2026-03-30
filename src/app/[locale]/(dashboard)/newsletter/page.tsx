import { StaffGuard } from "@/components/dashboard/staff-guard";
import { NewsletterPanel } from "@/components/pages/newsletter-panel";

export default function NewsletterPage() {
  return (
    <StaffGuard>
      <NewsletterPanel />
    </StaffGuard>
  );
}
