'use client'

import Link from 'next/link'
import { ContractStatusBadge } from './ContractStatusBadge'
import { RiskBadge } from '@/components/analysis/RiskBadge'
import { formatRelativeDate, formatFileSize } from '@/lib/utils'
import { CONTRACT_TYPE_LABELS, INDUSTRY_LABELS } from '@/types'
import type { Contract, RiskLevel } from '@/types'
import { cn } from '@/lib/utils'

interface ContractCardProps {
  contract: Contract
  onDelete?: (id: string) => void
}

const riskBorderMap: Record<RiskLevel, string> = {
  critical: 'border-l-4 border-l-red-500',
  high: 'border-l-4 border-l-orange-500',
  medium: 'border-l-4 border-l-yellow-400',
  low: 'border-l-4 border-l-blue-500',
  none: 'border-l-4 border-l-green-500',
}

export function ContractCard({ contract, onDelete }: ContractCardProps) {
  const riskBorder = contract.analysis
    ? riskBorderMap[contract.analysis.overallRiskLevel]
    : 'border-l-4 border-l-gray-200'

  return (
    <div className={cn(
      'group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md',
      riskBorder
    )}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <Link
          href={`/dashboard/contracts/${contract.id}`}
          className="flex-1 hover:underline"
        >
          <h3 className="font-semibold text-gray-900 line-clamp-1">{contract.title}</h3>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ContractStatusBadge status={contract.status} />
          {contract.analysis && (
            <RiskBadge level={contract.analysis.overallRiskLevel} showDot />
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
        <span>{CONTRACT_TYPE_LABELS[contract.contractType]}</span>
        <span className="text-gray-300">·</span>
        <span>{INDUSTRY_LABELS[contract.industry]}</span>
        {contract.counterparty && (
          <>
            <span className="text-gray-300">·</span>
            <span>{contract.counterparty}</span>
          </>
        )}
        <span className="text-gray-300">·</span>
        <span>{formatFileSize(contract.fileSize)}</span>
      </div>

      {contract.analysis && contract.status === 'completed' && (
        <div className="mb-3 flex gap-3 text-xs">
          {contract.analysis.criticalCount > 0 && (
            <span className="font-medium text-red-600">{contract.analysis.criticalCount} 매우위험</span>
          )}
          {contract.analysis.highCount > 0 && (
            <span className="font-medium text-orange-600">{contract.analysis.highCount} 위험</span>
          )}
          {contract.analysis.mediumCount > 0 && (
            <span className="font-medium text-yellow-600">{contract.analysis.mediumCount} 주의</span>
          )}
          {contract.analysis.criticalCount === 0 &&
            contract.analysis.highCount === 0 &&
            contract.analysis.mediumCount === 0 && (
              <span className="font-medium text-green-600">위험 조항 없음</span>
            )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{formatRelativeDate(contract.createdAt)}</span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <Link
            href={`/dashboard/contracts/${contract.id}`}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            상세보기
          </Link>
          {onDelete && (
            <button
              onClick={() => onDelete(contract.id)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}