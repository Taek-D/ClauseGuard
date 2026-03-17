'use client'

import { useState, useMemo } from 'react'
import { RiskSummary } from './RiskSummary'
import { ClauseCard } from './ClauseCard'
import type { ContractAnalysis, RiskLevel } from '@/types'

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

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: analysis.clauses.length }
    analysis.clauses.forEach((c) => {
      counts[c.riskLevel] = (counts[c.riskLevel] ?? 0) + 1
    })
    return counts
  }, [analysis.clauses])

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
            <ul className="space-y-1.5">
              {analysis.keyFindings.map((finding, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 shrink-0 text-blue-500">•</span>
                  {finding}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.recommendations.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-gray-700">권고사항</h4>
            <ul className="space-y-1.5">
              {analysis.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700">
                  <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-gray-900">
            조항별 분석
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({filteredClauses.length}건)
            </span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {RISK_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
                <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold leading-none ${
                  filter === opt.value
                    ? 'bg-white/20 text-white'
                    : 'bg-white text-gray-500'
                }`}>
                  {filterCounts[opt.value] ?? 0}
                </span>
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


**변경 요약:**

| 파일 | 변경 내용 |
|------|-----------|
| `Badge.tsx` | `bg-X-100 text-X-800` → `bg-X-50 text-X-700 ring-1 ring-inset` (세련된 테두리) |
| `Navbar.tsx` | `usePathname` 기반 활성 링크 강조, `backdrop-blur-sm`, 아바타 파란색 처리, `건 사용` 텍스트 추가 |
| `Sidebar.tsx` | `shadow-[inset_3px_0_0_#2563eb]`로 활성 항목 좌측 강조선, `gap-1 p-4` → `gap-0.5 p-3` |
| `ContractCard.tsx` | 리스크 레벨별 좌측 4px 컬러 테두리, 메타데이터에 `·` 구분자, 위험 없을 때 "위험 조항 없음" 표시 |
| `RiskSummary.tsx` | 점수 색상 코딩 (green/amber/orange/red), 그리드 항목 `py-2.5 + mt-0.5` 개선, 진행바 `h-3` |
| `ClauseCard.tsx` | 리스크 레벨별 좌측 3px 테두리, 펼침 시 `bg-gray-50/50` 배경, 원문에 `border bg-white` 카드 처리 |
| `AnalysisResult.tsx` | `useMemo`로 필터별 카운트 계산, 필터 버튼에 카운트 뱃지 표시 |