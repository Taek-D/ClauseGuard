'use client'

import Link from 'next/link'
import { ContractStatusBadge } from './ContractStatusBadge'
import { RiskBadge } from '@/components/analysis/RiskBadge'
import { formatRelativeDate, formatFileSize } from '@/lib/utils'
import { CONTRACT_TYPE_LABELS, INDUSTRY_LABELS } from '@/types'
import type { Contract } from '@/types'

interface ContractCardProps {
  contract: Contract
  onDelete?: (id: string) => void
}

export function ContractCard({ contract, onDelete }: ContractCardProps) {
  return (
    <div className="group rounded-xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
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

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>{CONTRACT_TYPE_LABELS[contract.contractType]}</span>
        <span>{INDUSTRY_LABELS[contract.industry]}</span>
        {contract.counterparty && <span>{contract.counterparty}</span>}
        <span>{formatFileSize(contract.fileSize)}</span>
      </div>

      {contract.analysis && contract.status === 'completed' && (
        <div className="mb-3 flex gap-3 text-xs">
          <span className="text-red-600 font-medium">{contract.analysis.criticalCount} 매우위험</span>
          <span className="text-orange-600 font-medium">{contract.analysis.highCount} 위험</span>
          <span className="text-yellow-600 font-medium">{contract.analysis.mediumCount} 주의</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{formatRelativeDate(contract.createdAt)}</span>
        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <Link
            href={`/dashboard/contracts/${contract.id}`}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            상세보기
          </Link>
          {onDelete && (
            <button
              onClick={() => onDelete(contract.id)}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
