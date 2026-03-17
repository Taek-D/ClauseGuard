import { Badge } from '@/components/ui/Badge'
import type { ContractStatus } from '@/types'

const STATUS_CONFIG: Record<ContractStatus, { label: string; variant: 'pending' | 'analyzing' | 'completed' | 'failed' }> = {
  pending: { label: '대기 중', variant: 'pending' },
  analyzing: { label: '분석 중', variant: 'analyzing' },
  completed: { label: '완료', variant: 'completed' },
  failed: { label: '실패', variant: 'failed' },
}

interface ContractStatusBadgeProps {
  status: ContractStatus
}

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant}>
      {status === 'analyzing' && (
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
      )}
      {config.label}
    </Badge>
  )
}
