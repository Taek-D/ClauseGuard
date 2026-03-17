import type {
  Contract,
  ContractFilters,
  PaginatedContracts,
  UploadContractInput,
  ContractAnalysis,
  ApiResponse,
} from '@/types'
import { uploadContractFile } from './supabase'
import { supabase } from './supabase'

async function fetchWithAuth<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    return {
      success: false,
      error: {
        code: String(res.status),
        message: err.message ?? '요청에 실패했습니다.',
        details: err.details,
      },
    }
  }

  const data = await res.json()
  return { success: true, data }
}

export const contractsApi = {
  async list(filters: ContractFilters = {}): Promise<ApiResponse<PaginatedContracts>> {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.contractType) params.set('contractType', filters.contractType)
    if (filters.industry) params.set('industry', filters.industry)
    if (filters.riskLevel) params.set('riskLevel', filters.riskLevel)
    if (filters.search) params.set('search', filters.search)
    if (filters.page) params.set('page', String(filters.page))
    if (filters.pageSize) params.set('pageSize', String(filters.pageSize))

    return fetchWithAuth<PaginatedContracts>(`/api/contracts?${params.toString()}`)
  },

  async get(id: string): Promise<ApiResponse<Contract>> {
    return fetchWithAuth<Contract>(`/api/contracts/${id}`)
  },

  async upload(input: UploadContractInput): Promise<ApiResponse<Contract>> {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user.id
    if (!userId) {
      return { success: false, error: { code: '401', message: '로그인이 필요합니다.' } }
    }

    let fileUrl: string
    let filePath: string
    try {
      const result = await uploadContractFile(userId, input.file)
      fileUrl = result.url
      filePath = result.path
    } catch {
      return { success: false, error: { code: 'UPLOAD_FAILED', message: '파일 업로드에 실패했습니다.' } }
    }

    return fetchWithAuth<Contract>('/api/contracts', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        fileName: input.file.name,
        fileUrl,
        filePath,
        fileSize: input.file.size,
        mimeType: input.file.type,
        contractType: input.contractType,
        industry: input.industry,
        counterparty: input.counterparty,
        effectiveDate: input.effectiveDate,
        expiryDate: input.expiryDate,
        tags: input.tags ?? [],
      }),
    })
  },

  async delete(id: string): Promise<ApiResponse<void>> {
    return fetchWithAuth<void>(`/api/contracts/${id}`, { method: 'DELETE' })
  },
}

export const analysisApi = {
  async trigger(contractId: string): Promise<ApiResponse<{ jobId: string }>> {
    return fetchWithAuth<{ jobId: string }>(`/api/contracts/${contractId}/analyze`, {
      method: 'POST',
    })
  },

  async get(contractId: string): Promise<ApiResponse<ContractAnalysis>> {
    return fetchWithAuth<ContractAnalysis>(`/api/contracts/${contractId}/analysis`)
  },
}
