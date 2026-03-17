'use client'

import { useState } from 'react'
import { RiskSummary } from './RiskSummary'
import { ClauseCard } from './ClauseCard'
import type { ContractAnalysis, RiskLevel } from '@/types'
import { RISK_LEVEL_LABELS } from '@/types'

interface AnalysisResultProps {
  analysis: ContractAnalysis
}

const RISK_FILTER_OPTIONS: { value: RiskLevel | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'critical', label: '매우 위험' },
  { value: 'high', label: '위험' },
  { value: 'medium', label: '주의' },
  { value: 'low', label: '낮음' },
]

export function AnalysisResult({ analysis }: AnalysisResultProps) {
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all')

  const filteredClauses =
    filter === 'all'
      ? analysis.clauses
      : analysis.clauses.filter((c) => c.riskLevel === filter)

  return (
    <div className="flex flex-col gap-6">
      <RiskSummary analysis={analysis} />

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="mb-3 font-semibold text-gray-900">핵심 요약</h3>
        <p className="text-sm leading-relaxed text-gray-700">{analysis.summary}</p>

        {analysis.keyFindings.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">주요 발견사항</h4>
            <ul className="space-y-1">
              {analysis.keyFindings.map((finding, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 text-blue-500">•</span>
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">권고사항</h4>
            <ul className="space-y-1">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 text-green-500">✓</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            조항별 분석
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredClauses.length}건)
            </span>
          </h3>
          <div className="flex gap-1.5">
            {RISK_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {filteredClauses.length === 0 ? (
            <div className="rounded-xl border border-gray-200 py-12 text-center text-sm text-gray-500">
              해당 리스크 수준의 조항이 없습니다.
            </div>
          ) : (
            filteredClauses.map((clause, i) => (
              <ClauseCard key={clause.id} clause={clause} index={i} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
