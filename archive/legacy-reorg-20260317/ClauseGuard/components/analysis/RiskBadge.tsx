import { Badge } from '@/components/ui/Badge'
import { RISK_LEVEL_LABELS } from '@/types'
import type { RiskLevel } from '@/types'

interface RiskBadgeProps {
  level: RiskLevel
  showDot?: boolean
  className?: string
}

export function RiskBadge({ level, showDot = false, className }: RiskBadgeProps) {
  return (
    <Badge variant={level} className={className}>
      {showDot && (
        <span
          className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${
            level === 'critical'
              ? 'bg-red-600'
              : level === 'high'
              ? 'bg-orange-600'
              : level === 'medium'
              ? 'bg-yellow-600'
              : level === 'low'
              ? 'bg-blue-600'
              : 'bg-green-600'
          }`}
        />
      )}
      {RISK_LEVEL_LABELS[level]}
    </Badge>
  )
}
