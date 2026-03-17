'use client'

import { useEffect } from 'react'
import { ContractCard } from './ContractCard'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { useContractStore } from '@/store/useContractStore'

interface ContractListProps {
  onUploadClick: () => void
}

export function ContractList({ onUploadClick }: ContractListProps) {
  const { contracts, isLoading, error, total, filters, fetchContracts, deleteContract, setFilters } =
    useContractStore()

  useEffect(() => {
    fetchContracts()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('계약서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    await deleteContract(id)
  }

  const handleNextPage = () => {
    const nextPage = (filters.page ?? 1) + 1
    const newFilters = { ...filters, page: nextPage }
    setFilters(newFilters)
    fetchContracts(newFilters)
  }

  const handlePrevPage = () => {
    const prevPage = Math.max(1, (filters.page ?? 1) - 1)
    const newFilters = { ...filters, page: prevPage }
    setFilters(newFilters)
    fetchContracts(newFilters)
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" label="계약서를 불러오는 중..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchContracts()}>
          다시 시도
        </Button>
      </div>
    )
  }

  if (contracts.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        }
        title="계약서가 없습니다"
        description="첫 번째 계약서를 업로드하여 AI 리뷰를 시작하세요."
        action={
          <Button onClick={onUploadClick}>
            계약서 업로드
          </Button>
        }
      />
    )
  }

  const currentPage = filters.page ?? 1
  const pageSize = filters.pageSize ?? 10
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">총 {total}건</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contracts.map((contract) => (
          <ContractCard key={contract.id} contract={contract} onDelete={handleDelete} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            이전
          </Button>
          <span className="text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  )
}
