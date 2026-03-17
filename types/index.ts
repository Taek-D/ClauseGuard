export type RuntimeMode = "mock" | "supabase";

export type IndustryType = "saas" | "manufacturing" | "realestate" | "service" | "other";
export type PlanType = "free" | "starter" | "professional" | "team";
export type OrgRole = "owner" | "admin" | "member" | "viewer";
export type MemberStatus = "active" | "pending" | "deactivated";
export type AuthProvider = "email" | "google";
export type RolePreference = "executive" | "legal" | "sales" | "freelancer";
export type FileType = "pdf" | "docx" | "hwp";
export type ContractStatus = "uploaded" | "parsing" | "analyzing" | "completed" | "failed";
export type Severity = "high" | "medium" | "low";
export type ContractType = "subscription" | "nda" | "service" | "partnership" | "lease" | "other";
export type PartyPosition = "provider" | "consumer";
export type AnalysisStatus =
  | "parsing"
  | "classifying"
  | "risk_analyzing"
  | "suggesting"
  | "reporting"
  | "completed"
  | "failed";
export type ClauseCategory =
  | "liability"
  | "termination"
  | "renewal"
  | "ip"
  | "indemnity"
  | "confidentiality"
  | "payment"
  | "other";
export type ShareScope = "full_report" | "high_risk_only";
export type DocumentLanguage = "ko" | "en" | "mixed";
export type UserLanguage = "ko" | "en";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  auth_provider: AuthProvider;
  role_preference: RolePreference | null;
  language: UserLanguage;
  plan: PlanType;
  role: OrgRole;
  organization_name: string;
}

export interface Organization {
  id: string;
  name: string;
  industry: IndustryType;
  plan: PlanType;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  auth_provider: AuthProvider;
  role_preference: RolePreference | null;
  mfa_enabled: boolean;
  language: UserLanguage;
  created_at: string;
  last_login_at: string | null;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string | null;
  role: OrgRole;
  invited_at: string;
  joined_at: string | null;
  status: MemberStatus;
  invite_email?: string | null;
  invite_token?: string | null;
}

export interface Contract {
  id: string;
  org_id: string;
  uploaded_by: string;
  file_name: string;
  file_type: FileType;
  file_size_bytes: number;
  file_storage_key: string;
  page_count: number | null;
  language: DocumentLanguage | null;
  industry: IndustryType;
  contract_type: ContractType;
  party_position: PartyPosition;
  status: ContractStatus;
  overall_risk_score: number | null;
  risk_level: Severity | null;
  template_id: string | null;
  expires_at: string;
  deleted_at: string | null;
  created_at: string;
}

export interface Analysis {
  id: string;
  contract_id: string;
  status: AnalysisStatus;
  progress_pct: number;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  model_version: string;
  error_message: string | null;
  focus_areas: string[] | null;
}

export interface Clause {
  id: string;
  contract_id: string;
  clause_number: string;
  page: number;
  category: ClauseCategory;
  original_text: string;
  summary: string;
  order_index: number;
}

export interface Risk {
  id: string;
  clause_id: string;
  contract_id: string;
  severity: Severity;
  risk_type: string;
  title: string;
  description: string;
  industry_benchmark: string | null;
  benchmark_pct: number | null;
  order_index: number;
}

export interface Suggestion {
  id: string;
  risk_id: string;
  suggested_text: string;
  change_rationale: string;
  negotiation_tip: string | null;
  accepted: boolean | null;
}

export interface ReportRisk extends Risk {
  clauses?: Clause | null;
  suggestions?: Suggestion[] | null;
}

export interface ReportSummary {
  high_count: number;
  medium_count: number;
  low_count: number;
  overall_score: number | null;
}

export interface ReportData {
  contract: Contract;
  analysis: Analysis | null;
  risks: ReportRisk[];
  summary: ReportSummary;
}

export interface ContractFilters {
  search?: string;
  industry?: IndustryType;
  contract_type?: ContractType;
  status?: ContractStatus;
  risk_level?: Severity;
  page?: number;
  limit?: number;
}

export interface UploadContractInput {
  file: File;
  industry: IndustryType;
  contract_type: ContractType;
  party_position: PartyPosition;
  focus_areas?: string[];
}

export interface ContractListResponse {
  items: Contract[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResult<T> {
  data?: T;
  error?: ApiError;
}

export const INDUSTRY_LABELS: Record<IndustryType, string> = {
  saas: "SaaS",
  manufacturing: "제조",
  realestate: "부동산",
  service: "서비스",
  other: "기타",
};

export const PLAN_LABELS: Record<PlanType, string> = {
  free: "Free",
  starter: "Starter",
  professional: "Professional",
  team: "Team",
};

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  subscription: "구독 계약",
  nda: "NDA",
  service: "용역 계약",
  partnership: "파트너십",
  lease: "임대차",
  other: "기타",
};

export const PARTY_POSITION_LABELS: Record<PartyPosition, string> = {
  provider: "제공자 입장",
  consumer: "수요자 입장",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  uploaded: "업로드됨",
  parsing: "문서 파싱",
  analyzing: "리스크 분석 중",
  completed: "리포트 준비 완료",
  failed: "분석 실패",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  parsing: "문서 파싱",
  classifying: "조항 분류",
  risk_analyzing: "리스크 분석",
  suggesting: "수정 제안 생성",
  reporting: "리포트 구성",
  completed: "완료",
  failed: "실패",
};

export const ANALYSIS_PIPELINE: AnalysisStatus[] = [
  "parsing",
  "classifying",
  "risk_analyzing",
  "suggesting",
  "reporting",
  "completed",
];
