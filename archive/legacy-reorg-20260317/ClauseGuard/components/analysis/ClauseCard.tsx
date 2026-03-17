'use client'

import { useState } from 'react'
import { RiskBadge } from './RiskBadge'
import type { ClauseRisk } from '@/types'

interface ClauseCardProps {
  clause: ClauseRisk
  index: number
}

export function ClauseCard({ clause, index }: ClauseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-sm">
      <button
        className="flex w-full items-start justify-between gap-4 p-4 text-left"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
            {index + 1}
          </span>
          <div>
            <p className="font-medium text-gray-900">{clause.title}</p>
            <p className="mt-0.5 text-xs text-gray-500">{clause.riskCategory}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RiskBadge level={clause.riskLevel} showDot />
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
          <div className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">원문</p>
            <blockquote className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 italic">
              {clause.originalText}
            </blockquote>
          </div>
          <div className="mb-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">리스크 설명</p>
            <p className="text-sm text-gray-700">{clause.explanation}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">권고사항</p>
            <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800">{clause.recommendation}</p>
          </div>
          {clause.pageNumber && (
            <p className="mt-2 text-xs text-gray-400">페이지 {clause.pageNumber}</p>
          )}
        </div>
      )}
    </div>
  )
}
