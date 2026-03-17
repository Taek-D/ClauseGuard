import { Badge } from "@/components/ui/Badge";
import { SEVERITY_LABELS, type Severity } from "@/types";

interface RiskBadgeProps {
  severity: Severity;
  showDot?: boolean;
}

export function RiskBadge({ severity, showDot = false }: RiskBadgeProps) {
  return (
    <Badge variant={severity}>
      {showDot ? <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}
