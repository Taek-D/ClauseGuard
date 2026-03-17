import { Badge } from "@/components/ui/Badge";
import { CONTRACT_STATUS_LABELS, type ContractStatus } from "@/types";

interface ContractStatusBadgeProps {
  status: ContractStatus;
}

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  return (
    <Badge variant={status}>
      {status === "analyzing" || status === "parsing" ? (
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {CONTRACT_STATUS_LABELS[status]}
    </Badge>
  );
}
