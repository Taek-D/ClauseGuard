export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none'

export type ContractStatus = 'pending' | 'analyzing' | 'completed' | 'failed'

export type ContractType =
  | 'nda'
  | 'saas'
  | 'service'
  | 'partnership'
  | 'lease'
  | 'employment'
  | 'other'

export type Industry =
  | 'technology'
  | 'manufacturing'
  | 'retail'
  | 'real_estate'
  | 'finance'
  | 'healthcare'
  | 'other'

export type Language = 'ko' | 'en' | 'mixed'

export type Plan = 'free' | 'starter' | 'professional' | 'enterprise'

export interface User {
  id: string
  email: string
  name: string
  company?: string
  plan: Plan
  contractsUsed: number
  contractsLimit: number
  createdAt: string
}

export interface ClauseRisk {
  id: string
  title: string
  originalText: string
  riskLevel: RiskLevel
  riskCategory: string
  explanation: string
  recommendation: string
  pageNumber?: number
}

export interface ContractAnalysis {
  id: string
  contractId: string
  overallRiskLevel: RiskLevel
  riskScore: number
  summary: string
  clauses: ClauseRisk[]
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  keyFindings: string[]
  recommendations: string[]
  language: Language
  analyzedAt: string
}

export interface Contract {
  id: string
  userId: string
  title: string
  fileName: string
  fileUrl: string
  fileSize: number
  mimeType: string
  contractType: ContractType
  industry: Industry
  status: ContractStatus
  analysis?: ContractAnalysis
  counterparty?: string
  effectiveDate?: string
  expiryDate?: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface UploadContractInput {
  file: File
  title: string
  contractType: ContractType
  industry: Industry
  counterparty?: string
  effectiveDate?: string
  expiryDate?: string
  tags?: string[]
}

export interface PaginatedContracts {
  contracts: Contract[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ContractFilters {
  status?: ContractStatus
  contractType?: ContractType
  industry?: Industry
  riskLevel?: RiskLevel
  search?: string
  page?: number
  pageSize?: number
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, string>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  nda: 'NDA (비밀유지)',
  saas: 'SaaS 이용약관',
  service: '용역 계약',
  partnership: '파트너십',
  lease: '임대차',
  employment: '고용 계약',
  other: '기타',
}

export const INDUSTRY_LABELS: Record<Industry, string> = {
  technology: '기술/IT',
  manufacturing: '제조',
  retail: '유통/리테일',
  real_estate: '부동산',
  finance: '금융',
  healthcare: '의료/헬스케어',
  other: '기타',
}

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  critical: '매우 위험',
  high: '위험',
  medium: '주의',
  low: '낮음',
  none: '안전',
}
