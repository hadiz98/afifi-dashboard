import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function RoleBadge({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-border/70 bg-muted/40 text-xs font-medium capitalize text-foreground/90 shadow-none",
        className
      )}
    >
      {role}
    </Badge>
  );
}
