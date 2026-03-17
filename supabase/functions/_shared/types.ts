export type IndustryType = "saas" | "manufacturing" | "realestate" | "service" | "other";
export type PlanType = "free" | "starter" | "professional" | "team";
export type OrgRole = "owner" | "admin" | "member" | "viewer";
export type MemberStatus = "active" | "pending" | "deactivated";
export type AuthProvider = "email" | "google";
export type RolePreference = "executive" | "legal" | "sales" | "freelancer";
export type FileType = "pdf" | "docx" | "hwp";
export type ContractStatus = "uploaded" | "parsing" | "analyzing" | "completed" | "failed";
export type RiskLevel = "high" | "medium" | "low";
export type ContractType = "subscription" | "nda" | "service" | "partnership" | "lease" | "other";
export type PartyPosition = "provider" | "consumer";
export type AnalysisStatus = "parsing" | "classifying" | "risk_analyzing" | "suggesting" | "reporting" | "completed" | "failed";
export type ClauseCategory = "liability" | "termination" | "renewal" | "ip" | "indemnity" | "confidentiality" | "payment" | "other";
export type Severity = "high" | "medium" | "low";
export type ShareScope = "full_report" | "high_risk_only";
export type SubscriptionStatus = "active" | "past_due" | "cancelled";
export type BillingCycle = "monthly" | "annual";
export type AuditAction = "upload" | "analyze" | "export" | "delete" | "share" | "invite" | "role_change" | "login" | "settings_change";
export type DocumentLanguage = "ko" | "en" | "mixed";
export type UserLanguage = "ko" | "en";

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
  user_id: string;
  role: OrgRole;
  invited_at: string;
  joined_at: string | null;
  status: MemberStatus;
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
  risk_level: RiskLevel | null;
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

export interface Template {
  id: string;
  org_id: string | null;
  name: string;
  industry: IndustryType;
  contract_type: ContractType;
  is_system: boolean;
  base_template_id: string | null;
  rule_count: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateRule {
  id: string;
  template_id: string;
  clause_category: ClauseCategory;
  rule_description: string;
  severity_if_violated: Severity;
  benchmark_text: string | null;
  order_index: number;
}

export interface ShareLink {
  id: string;
  contract_id: string;
  created_by: string;
  token: string;
  recipient_email: string | null;
  scope: ShareScope;
  expires_at: string;
  accessed_at: string | null;
}

export interface Subscription {
  id: string;
  org_id: string;
  plan: PlanType;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  seat_limit: number;
  api_call_limit: number | null;
}

export interface AuditLog {
  id: string;
  org_id: string;
  user_id: string;
  action: AuditAction;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
