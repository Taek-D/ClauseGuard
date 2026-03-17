파일 쓰기 권한이 아직 없습니다. 요청하신 대로 수정된 전체 코드를 출력합니다.

---

=== FILE: components/ui/Badge.tsx ===

```tsx
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        critical: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
        high: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20',
        medium: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20',
        low: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
        none: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
        pending: 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20',
        analyzing: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
        completed: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
        failed: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20',
        default: 'bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
```

---

=== FILE: components/layout/Navbar.tsx ===

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/useAuthStore'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { href: '/dashboard', label: '대시보드', exact: true },
  { href: '/dashboard/contracts', label: '계약서', exact: false },
]

export function Navbar() {
  const { user, signOut } = useAuthStore()
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-sm">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight text-gray-900">ClauseGuard</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, label, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">
                {user.contractsUsed} / {user.contractsLimit === -1 ? '무제한' : user.contractsLimit}건 사용
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-sm">
              {user.name[0]}
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              로그아웃
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
```

---

=== FILE: components/layout/Sidebar.tsx ===

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: '대시보드',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/dashboard/contracts',
    label: '계약서 목록',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: '설정',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <nav className="flex flex-col gap-0.5 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-[inset_3px_0_0_#2563eb]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <span className={cn('shrink-0', isActive ? 'text-blue-600' : 'text-gray-400')}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

---

=== FILE: components/contract/ContractCard.tsx ===

```tsx
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
```

---

=== FILE: components/analysis/RiskSummary.tsx ===

```tsx
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
```

---

=== FILE: components/analysis/ClauseCard.tsx ===

```tsx
'use client'

import { useState } from 'react'
import { RiskBadge } from './RiskBadge'
import type { ClauseRisk, RiskLevel } from '@/types'
import { cn } from '@/lib/utils'

interface ClauseCardProps {
  clause: ClauseRisk
  index: number
}

const riskBorderMap: Record<RiskLevel, string> = {
  critical: 'border-l-[3px] border-l-red-500',
  high: 'border-l-[3px] border-l-orange-500',
  medium: 'border-l-[3px] border-l-amber-400',
  low: 'border-l-[3px] border-l-blue-500',
  none: 'border-l-[3px] border-l-green-500',
}

export function ClauseCard({ clause, index }: ClauseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={cn(
      'rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-sm',
      riskBorderMap[clause.riskLevel]
    )}>
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
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 pb-4 pt-3">
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">원문</p>
            <blockquote className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm italic text-gray-700">
              {clause.originalText}
            </blockquote>
          </div>
          <div className="mb-3">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">리스크 설명</p>
            <p className="text-sm text-gray-700">{clause.explanation}</p>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">권고사항</p>
            <p className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-800 ring-1 ring-inset ring-blue-100">
              {clause.recommendation}
            </p>
          </div>
          {clause.pageNumber && (
            <p className="mt-2.5 text-xs text-gray-400">페이지 {clause.pageNumber}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

---

=== FILE: components/analysis/AnalysisResult.tsx ===

```tsx
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
```

---

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