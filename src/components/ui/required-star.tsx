import { cn } from "@/lib/utils";

/** Visual required indicator for form labels (pair with backend / zod rules). */
export function RequiredStar({ className }: { className?: string }) {
  return (
    <span
      className={cn("ms-0.5 font-semibold text-destructive", className)}
      title="Required"
      aria-hidden
    >
      *
    </span>
  );
}
