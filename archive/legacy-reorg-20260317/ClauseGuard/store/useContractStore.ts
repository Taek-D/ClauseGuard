'use client'

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { contractsApi, analysisApi } from '@/lib/api'
import type { Contract, ContractFilters, UploadContractInput } from '@/types'

interface ContractState {
  contracts: Contract[]
  selectedContract: Contract | null
  total: number
  isLoading: boolean
  isUploading: boolean
  error: string | null
  filters: ContractFilters

  fetchContracts: (filters?: ContractFilters) => Promise<void>
  fetchContract: (id: string) => Promise<void>
  uploadContract: (input: UploadContractInput) => Promise<Contract | null>
  deleteContract: (id: string) => Promise<boolean>
  triggerAnalysis: (contractId: string) => Promise<boolean>
  setFilters: (filters: ContractFilters) => void
  selectContract: (contract: Contract | null) => void
  clearError: () => void
}

export const useContractStore = create<ContractState>()(
  devtools(
    (set, get) => ({
      contracts: [],
      selectedContract: null,
      total: 0,
      isLoading: false,
      isUploading: false,
      error: null,
      filters: { page: 1, pageSize: 10 },

      fetchContracts: async (filters) => {
        set({ isLoading: true, error: null })
        const activeFilters = filters ?? get().filters
        const res = await contractsApi.list(activeFilters)
        if (res.success && res.data) {
          set({
            contracts: res.data.contracts,
            total: res.data.total,
            isLoading: false,
          })
        } else {
          set({ error: res.error?.message ?? '목록 조회에 실패했습니다.', isLoading: false })
        }
      },

      fetchContract: async (id) => {
        set({ isLoading: true, error: null })
        const res = await contractsApi.get(id)
        if (res.success && res.data) {
          set({ selectedContract: res.data, isLoading: false })
        } else {
          set({ error: res.error?.message ?? '계약서 조회에 실패했습니다.', isLoading: false })
        }
      },

      uploadContract: async (input) => {
        set({ isUploading: true, error: null })
        const res = await contractsApi.upload(input)
        if (res.success && res.data) {
          set((state) => ({
            contracts: [res.data!, ...state.contracts],
            total: state.total + 1,
            isUploading: false,
          }))
          return res.data
        } else {
          set({ error: res.error?.message ?? '업로드에 실패했습니다.', isUploading: false })
          return null
        }
      },

      deleteContract: async (id) => {
        const res = await contractsApi.delete(id)
        if (res.success) {
          set((state) => ({
            contracts: state.contracts.filter((c) => c.id !== id),
            total: state.total - 1,
          }))
          return true
        }
        set({ error: res.error?.message ?? '삭제에 실패했습니다.' })
        return false
      },

      triggerAnalysis: async (contractId) => {
        const res = await analysisApi.trigger(contractId)
        if (res.success) {
          set((state) => ({
            contracts: state.contracts.map((c) =>
              c.id === contractId ? { ...c, status: 'analyzing' as const } : c
            ),
          }))
          return true
        }
        set({ error: res.error?.message ?? '분석 시작에 실패했습니다.' })
        return false
      },

      setFilters: (filters) => {
        set({ filters: { ...get().filters, ...filters } })
      },

      selectContract: (contract) => {
        set({ selectedContract: contract })
      },

      clearError: () => set({ error: null }),
    }),
    { name: 'contract-store' }
  )
)
