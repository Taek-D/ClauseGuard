import type { ContractAnalysis } from '@/types'

interface RiskSummaryProps {
  analysis: ContractAnalysis
}

const riskItems = [
  { key: 'criticalCount' as const, label: '매우 위험', color: 'bg-red-500', textColor: 'text-red-700', bg: 'bg-red-50' },
  { key: 'highCount' as const, label: '위험', color: 'bg-orange-500', textColor: 'text-orange-700', bg: 'bg-orange-50' },
  { key: 'mediumCount' as const, label: '주의', color: 'bg-amber-400', textColor: 'text-amber-700', bg: 'bg-amber-50' },
  { key: 'lowCount' as const, label: '낮음', color: 'bg-blue-500', textColor: 'text-blue-700', bg: 'bg-blue-50' },
]

function getScoreStyle(score: number): { color: string; label: string } {
  if (score >= 70) return { color: 'text-red-600', label: '매우 위험' }
  if (score >= 40) return { color: 'text-orange-500', label: '주의 필요' }
  if (score >= 20) return { color: 'text-amber-500', label: '낮은 위험' }
  return { color: 'text-green-600', label: '안전' }
}

export function RiskSummary({ analysis }: RiskSummaryProps) {
  const totalClauses = analysis.criticalCount + analysis.highCount + analysis.mediumCount + analysis.lowCount
  const { color: scoreColor, label: scoreLabel } = getScoreStyle(analysis.riskScore)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">리스크 요약</h3>
        <div className="text-right">
          <div className={`text-3xl font-bold ${scoreColor}`}>{analysis.riskScore}</div>
          <div className="text-xs text-gray-500">{scoreLabel} (0-100)</div>
        </div>
      </div>

      <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {totalClauses > 0 && (
          <div className="flex h-full">
            {riskItems.map(({ key, color }) =>
              analysis[key] > 0 ? (
                <div
                  key={key}
                  className={color}
                  style={{ width: `${(analysis[key] / totalClauses) * 100}%` }}
                />
              ) : null
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {riskItems.map(({ key, label, textColor, bg }) => (
          <div key={key} className={`rounded-lg ${bg} px-3 py-2.5 text-center`}>
            <div className={`text-2xl font-bold ${textColor}`}>{analysis[key]}</div>
            <div className="mt-0.5 text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}