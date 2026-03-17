"use client";

import type {
  Analysis,
  AnalysisStatus,
  AppUser,
  Clause,
  Contract,
  ContractFilters,
  ContractListResponse,
  ContractType,
  ReportData,
  ReportRisk,
  Severity,
  Suggestion,
  UploadContractInput,
} from "@/types";

const STORAGE_KEY = "clauseguard:mvp-workspace";
const DEMO_ORG_ID = "org-demo-clauseguard";

interface MockWorkspace {
  initialized_at: string;
  user: AppUser | null;
  contracts: Contract[];
  analyses: Analysis[];
  reports: Record<string, ReportData>;
}

interface RiskTemplate {
  title: string;
  severity: Severity;
  risk_type: string;
  clause_number: string;
  page: number;
  category: Clause["category"];
  original_text: string;
  summary: string;
  description: string;
  suggested_text: string;
  change_rationale: string;
  negotiation_tip: string | null;
  industry_benchmark: string | null;
  benchmark_pct: number | null;
}

const ANALYSIS_STEPS: AnalysisStatus[] = [
  "parsing",
  "classifying",
  "risk_analyzing",
  "suggesting",
  "reporting",
  "completed",
];

const STEP_PROGRESS: Record<AnalysisStatus, number> = {
  parsing: 16,
  classifying: 34,
  risk_analyzing: 62,
  suggesting: 82,
  reporting: 94,
  completed: 100,
  failed: 100,
};

function nowIso(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60000).toISOString();
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createDemoUser(email = "demo@clauseguard.app"): AppUser {
  return {
    id: "user-demo-owner",
    email,
    name: "ClauseGuard Demo",
    auth_provider: email.endsWith("@gmail.com") ? "google" : "email",
    role_preference: "executive",
    language: "ko",
    plan: "professional",
    role: "owner",
    organization_name: "ClauseGuard Labs",
  };
}

function getRiskTemplates(contractType: ContractType): RiskTemplate[] {
  if (contractType === "subscription") {
    return [
      {
        title: "자동 갱신 기한이 과도하게 길게 잡혀 있습니다",
        severity: "high",
        risk_type: "auto_renewal",
        clause_number: "제4조",
        page: 3,
        category: "renewal",
        original_text:
          "본 계약은 12개월마다 자동 갱신되며, 수요자는 갱신일 90일 전까지 서면 통지하지 않으면 갱신에 동의한 것으로 본다.",
        summary: "해지 통지 기한이 길어 계약 갱신을 놓칠 위험이 큽니다.",
        description: "자동 갱신을 유지하더라도 통지 기한은 30일 전후로 낮추는 것이 일반적입니다.",
        suggested_text:
          "각 당사자는 갱신일 30일 전까지 서면 통지로 갱신을 거절할 수 있다.",
        change_rationale: "해지 및 재협상 타이밍을 관리 가능한 수준으로 되돌립니다.",
        negotiation_tip: "자동 갱신은 유지하되 통지 기한만 조정하는 안이 수용성이 높습니다.",
        industry_benchmark: "SaaS 표준 계약은 30일 전 통지를 많이 사용합니다.",
        benchmark_pct: 72,
      },
      {
        title: "가격 조정 상한이 없습니다",
        severity: "medium",
        risk_type: "price_change",
        clause_number: "제6조",
        page: 4,
        category: "payment",
        original_text:
          "공급자는 사전 통지 후 언제든지 이용요금을 조정할 수 있으며 이용자는 계속 사용함으로써 이에 동의한다.",
        summary: "가격 인상 폭과 시점이 제한되지 않습니다.",
        description: "예산 계획이 흔들리고 연간 계약의 예측 가능성이 낮아집니다.",
        suggested_text:
          "이용요금 조정은 갱신 시점에만 가능하며 직전 금액의 10%를 초과할 수 없다.",
        change_rationale: "비용 예측 가능성을 확보하고 갑작스러운 인상을 방지합니다.",
        negotiation_tip: "상한선이 어렵다면 CPI 연동 방식으로 완화할 수 있습니다.",
        industry_benchmark: "연 단위 갱신 시 조정 또는 상한선 부여가 일반적입니다.",
        benchmark_pct: 64,
      },
      {
        title: "SLA 미달 시 종료권이 없습니다",
        severity: "low",
        risk_type: "sla_credit",
        clause_number: "제8조",
        page: 5,
        category: "other",
        original_text:
          "서비스 수준 목표 미달 시 이용자의 유일한 구제수단은 서비스 크레딧으로 한정된다.",
        summary: "반복적 품질 문제에도 실질적인 종료권이 없습니다.",
        description: "핵심 업무 도구일수록 반복 장애에 대한 종료권이 있어야 합니다.",
        suggested_text:
          "동일한 SLA 미달이 3개월 연속 발생하는 경우 이용자는 위약금 없이 계약을 종료할 수 있다.",
        change_rationale: "서비스 품질 이슈가 누적될 때 퇴로를 확보합니다.",
        negotiation_tip: "해지권이 어렵다면 크레딧 상향과 병행 제안도 가능합니다.",
        industry_benchmark: "핵심 도구는 반복 장애 시 종료권을 두는 경우가 있습니다.",
        benchmark_pct: 41,
      },
    ];
  }

  if (contractType === "nda") {
    return [
      {
        title: "기밀 유지 기간이 무기한입니다",
        severity: "high",
        risk_type: "perpetual_term",
        clause_number: "제5조",
        page: 3,
        category: "confidentiality",
        original_text: "본 계약상의 기밀 유지 의무는 계약 종료 후에도 영구적으로 존속한다.",
        summary: "모든 정보에 대해 영구 의무를 부과하고 있습니다.",
        description: "영업비밀 외 정보까지 영구 보호 대상으로 남아 실무 부담이 큽니다.",
        suggested_text:
          "기밀 유지 의무는 계약 종료 후 3년간 존속하되, 영업비밀에 한해 법령상 보호기간 동안 유지한다.",
        change_rationale: "정보 유형에 따라 보호 기간을 합리적으로 나눕니다.",
        negotiation_tip: "영업비밀만 별도 보호하는 구조는 상대방도 수용하기 쉽습니다.",
        industry_benchmark: "NDA는 2~3년 또는 영업비밀 예외 구조가 일반적입니다.",
        benchmark_pct: 70,
      },
      {
        title: "기밀정보 예외 범위가 좁습니다",
        severity: "medium",
        risk_type: "confidentiality_scope",
        clause_number: "제2조",
        page: 2,
        category: "confidentiality",
        original_text:
          "수령 당사자는 공개 여부와 무관하게 제공받은 모든 정보를 영구적으로 기밀정보로 취급한다.",
        summary: "공개정보, 독자 개발 정보 같은 예외가 빠져 있습니다.",
        description: "통상 허용되는 범위까지 제한돼 운영 부담이 커질 수 있습니다.",
        suggested_text:
          "공개정보, 독자 개발 정보, 적법하게 제3자로부터 취득한 정보는 기밀정보에서 제외한다.",
        change_rationale: "시장 표준 예외를 반영해 과도한 제한을 줄입니다.",
        negotiation_tip: "상호주의 관점으로 설명하면 수용성이 높아집니다.",
        industry_benchmark: "표준 NDA는 공개정보와 독자 개발 정보를 대부분 예외로 둡니다.",
        benchmark_pct: 88,
      },
      {
        title: "가처분 구제가 폭넓게 열려 있습니다",
        severity: "low",
        risk_type: "injunctive_relief",
        clause_number: "제6조",
        page: 4,
        category: "liability",
        original_text:
          "제공 당사자는 금전배상과 별도로 가처분 등 모든 형평법상 구제를 청구할 수 있다.",
        summary: "분쟁 시 즉각적인 긴급 구제까지 허용됩니다.",
        description: "실무상 압박 수단으로 사용될 가능성이 있습니다.",
        suggested_text:
          "형평법상 구제는 중대한 기밀 침해가 명백한 경우에 한하여 청구할 수 있다.",
        change_rationale: "남용 가능성을 줄이고 구제 범위를 좁힙니다.",
        negotiation_tip: "핵심 영업비밀에 한정하는 방향으로 협상해 보세요.",
        industry_benchmark: "핵심 영업비밀에 한정하는 사례가 늘고 있습니다.",
        benchmark_pct: 39,
      },
    ];
  }

  return [
    {
      title: "손해배상 책임 한도가 없습니다",
      severity: "high",
      risk_type: "unlimited_liability",
      clause_number: "제11조",
      page: 6,
      category: "liability",
      original_text:
        "수급인은 본 계약과 관련하여 발생하는 모든 손해에 대해 제한 없이 배상 책임을 부담한다.",
      summary: "가장 전형적인 고위험 조항입니다.",
      description: "실제 거래 규모를 넘어서는 손해배상 청구로 이어질 수 있습니다.",
      suggested_text:
        "각 당사자의 총 손해배상 책임은 최근 12개월간 본 계약에 따라 지급된 총액을 한도로 한다.",
      change_rationale: "예상 가능한 범위 안에서 책임을 통제합니다.",
      negotiation_tip: "특별손해 배제 조항과 함께 제안하면 설득력이 높습니다.",
      industry_benchmark: "지급액 또는 계약금의 100~200% 상한을 많이 사용합니다.",
      benchmark_pct: 91,
    },
    {
      title: "편의 해지권이 일방적으로 부여되어 있습니다",
      severity: "medium",
      risk_type: "one_way_termination",
      clause_number: "제13조",
      page: 7,
      category: "termination",
      original_text:
        "발주자는 사유를 불문하고 7일 전 통지로 본 계약을 해지할 수 있다. 수급인은 그러하지 아니하다.",
      summary: "계약 지속 여부를 상대방이 일방적으로 통제합니다.",
      description: "리소스 투입 후 갑작스러운 종료 손실에 취약합니다.",
      suggested_text:
        "발주자의 편의 해지 시 이미 수행된 업무 대가와 합리적 종료 비용을 수급인에게 지급한다.",
      change_rationale: "갑작스러운 종료에 대한 최소 보호장치를 둡니다.",
      negotiation_tip: "쌍방 해지권이 어렵다면 보상 조항부터 확보해 보세요.",
      industry_benchmark: "쌍방 해지권 또는 종료 보상 조항을 두는 경우가 많습니다.",
      benchmark_pct: 68,
    },
    {
      title: "지식재산권 귀속 범위가 넓습니다",
      severity: "low",
      risk_type: "ip_ownership",
      clause_number: "제15조",
      page: 8,
      category: "ip",
      original_text: "본 계약에 따라 생산된 모든 결과물의 권리는 발주자에게 귀속된다.",
      summary: "선행 기술과 프로젝트 산출물의 경계가 모호합니다.",
      description: "기존 자산까지 이전되는 해석이 가능해집니다.",
      suggested_text:
        "개별 프로젝트 산출물의 권리는 발주자에게 귀속되되, 수급인의 선행 기술 및 범용 노하우는 수급인에게 잔존한다.",
      change_rationale: "재사용 가능한 핵심 자산을 보호합니다.",
      negotiation_tip: "선행 기술 예시를 부속서에 명시하면 협상이 쉬워집니다.",
      industry_benchmark: "프로젝트 산출물과 선행 기술을 구분하는 구조가 일반적입니다.",
      benchmark_pct: 55,
    },
  ];
}

function deriveSummary(risks: ReportRisk[]) {
  const high_count = risks.filter((risk) => risk.severity === "high").length;
  const medium_count = risks.filter((risk) => risk.severity === "medium").length;
  const low_count = risks.filter((risk) => risk.severity === "low").length;
  const overall_score = Math.max(18, 100 - high_count * 26 - medium_count * 12 - low_count * 5);

  return {
    high_count,
    medium_count,
    low_count,
    overall_score,
  };
}

function buildReportForContract(contract: Contract): ReportData {
  const risks = getRiskTemplates(contract.contract_type).map((template, index) => {
    const clause_id = makeId(`clause-${contract.id}`);
    const risk_id = makeId(`risk-${contract.id}`);
    const suggestion: Suggestion = {
      id: makeId(`suggestion-${contract.id}`),
      risk_id,
      suggested_text: template.suggested_text,
      change_rationale: template.change_rationale,
      negotiation_tip: template.negotiation_tip,
      accepted: null,
    };

    return {
      id: risk_id,
      clause_id,
      contract_id: contract.id,
      severity: template.severity,
      risk_type: template.risk_type,
      title: template.title,
      description: template.description,
      industry_benchmark: template.industry_benchmark,
      benchmark_pct: template.benchmark_pct,
      order_index: index,
      clauses: {
        id: clause_id,
        contract_id: contract.id,
        clause_number: template.clause_number,
        page: template.page,
        category: template.category,
        original_text: template.original_text,
        summary: template.summary,
        order_index: index,
      },
      suggestions: [suggestion],
    } satisfies ReportRisk;
  });

  const summary = deriveSummary(risks);

  return {
    contract: {
      ...contract,
      status: "completed",
      overall_risk_score: summary.overall_score,
      risk_level: summary.high_count > 0 ? "high" : summary.medium_count > 0 ? "medium" : "low",
    },
    analysis: {
      id: makeId(`analysis-${contract.id}`),
      contract_id: contract.id,
      status: "completed",
      progress_pct: 100,
      started_at: nowIso(-11),
      completed_at: nowIso(-4),
      duration_ms: 42000,
      model_version: "claude-3-5-sonnet",
      error_message: null,
      focus_areas: contract.contract_type === "subscription" ? ["갱신", "비용"] : ["책임", "해지"],
    },
    risks,
    summary,
  };
}

function createSeedWorkspace(): MockWorkspace {
  const completedContract: Contract = {
    id: "contract-demo-service",
    org_id: DEMO_ORG_ID,
    uploaded_by: "user-demo-owner",
    file_name: "master-service-agreement.pdf",
    file_type: "pdf",
    file_size_bytes: 1_742_540,
    file_storage_key: "mock/contracts/master-service-agreement.pdf",
    page_count: 14,
    language: "ko",
    industry: "service",
    contract_type: "service",
    party_position: "provider",
    status: "completed",
    overall_risk_score: 57,
    risk_level: "high",
    template_id: null,
    expires_at: nowIso(90 * 24 * 60),
    deleted_at: null,
    created_at: nowIso(-4 * 24 * 60),
  };

  const completedReport = buildReportForContract(completedContract);

  const activeContract: Contract = {
    id: "contract-demo-subscription",
    org_id: DEMO_ORG_ID,
    uploaded_by: "user-demo-owner",
    file_name: "annual-platform-subscription.docx",
    file_type: "docx",
    file_size_bytes: 842_190,
    file_storage_key: "mock/contracts/annual-platform-subscription.docx",
    page_count: 9,
    language: "en",
    industry: "saas",
    contract_type: "subscription",
    party_position: "consumer",
    status: "analyzing",
    overall_risk_score: null,
    risk_level: null,
    template_id: null,
    expires_at: nowIso(90 * 24 * 60),
    deleted_at: null,
    created_at: nowIso(-135),
  };

  return {
    initialized_at: nowIso(),
    user: null,
    contracts: [completedReport.contract, activeContract],
    analyses: [
      completedReport.analysis!,
      {
        id: "analysis-demo-subscription",
        contract_id: activeContract.id,
        status: "risk_analyzing",
        progress_pct: STEP_PROGRESS.risk_analyzing,
        started_at: nowIso(-12),
        completed_at: null,
        duration_ms: null,
        model_version: "claude-3-5-sonnet",
        error_message: null,
        focus_areas: ["pricing", "auto_renewal"],
      },
    ],
    reports: {
      [completedReport.contract.id]: completedReport,
    },
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readWorkspace(): MockWorkspace {
  if (!canUseStorage()) {
    return createSeedWorkspace();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = createSeedWorkspace();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(raw) as MockWorkspace;
  } catch {
    const seeded = createSeedWorkspace();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writeWorkspace(workspace: MockWorkspace) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

function updateWorkspace(mutator: (workspace: MockWorkspace) => MockWorkspace) {
  const next = mutator(readWorkspace());
  writeWorkspace(next);
  return next;
}

export function ensureMockWorkspace() {
  return readWorkspace();
}

export function getMockUser() {
  return readWorkspace().user;
}

export function setMockUser(user: AppUser | null): AppUser | null {
  return updateWorkspace((workspace) => ({ ...workspace, user })).user;
}

export function enterMockWorkspace(email?: string): AppUser {
  const user = createDemoUser(email);
  setMockUser(user);
  return user;
}

export function clearMockWorkspaceUser(): null {
  setMockUser(null);
  return null;
}

export function listMockContracts(filters: ContractFilters = {}): ContractListResponse {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 12;
  const query = filters.search?.trim().toLowerCase();

  const filtered = readWorkspace().contracts
    .filter((contract) => !contract.deleted_at)
    .filter((contract) => (filters.status ? contract.status === filters.status : true))
    .filter((contract) => (filters.industry ? contract.industry === filters.industry : true))
    .filter((contract) => (filters.contract_type ? contract.contract_type === filters.contract_type : true))
    .filter((contract) => (filters.risk_level ? contract.risk_level === filters.risk_level : true))
    .filter((contract) => (query ? contract.file_name.toLowerCase().includes(query) : true))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));

  const start = (page - 1) * limit;

  return {
    items: filtered.slice(start, start + limit),
    total: filtered.length,
    page,
    limit,
  };
}

export function getMockContract(contractId: string) {
  return readWorkspace().contracts.find((contract) => contract.id === contractId) ?? null;
}

export function getMockAnalysis(contractId: string) {
  return readWorkspace().analyses.find((analysis) => analysis.contract_id === contractId) ?? null;
}

export function getMockReport(contractId: string) {
  return readWorkspace().reports[contractId] ?? null;
}

export function updateMockSuggestionDecision(
  contractId: string,
  suggestionId: string,
  accepted: boolean | null,
) {
  let nextReport: ReportData | null = null;

  updateWorkspace((workspace) => {
    const currentReport = workspace.reports[contractId];
    if (!currentReport) {
      nextReport = null;
      return workspace;
    }

    const updatedReport: ReportData = {
      ...currentReport,
      risks: currentReport.risks.map((risk) => ({
        ...risk,
        suggestions: risk.suggestions?.map((suggestion) =>
          suggestion.id === suggestionId
            ? {
                ...suggestion,
                accepted,
              }
            : suggestion
        ) ?? null,
      })),
    };

    nextReport = updatedReport;

    return {
      ...workspace,
      reports: {
        ...workspace.reports,
        [contractId]: updatedReport,
      },
    };
  });

  return nextReport;
}

export function deleteMockContract(contractId: string) {
  updateWorkspace((workspace) => ({
    ...workspace,
    contracts: workspace.contracts.filter((contract) => contract.id !== contractId),
    analyses: workspace.analyses.filter((analysis) => analysis.contract_id !== contractId),
    reports: Object.fromEntries(Object.entries(workspace.reports).filter(([key]) => key !== contractId)),
  }));
}

export function uploadMockContract(input: UploadContractInput) {
  const uploaded_by = readWorkspace().user?.id ?? "user-demo-owner";
  const file_type = ((input.file.name.split(".").pop()?.toLowerCase() ?? "pdf") as Contract["file_type"]);

  const contract: Contract = {
    id: makeId("contract"),
    org_id: DEMO_ORG_ID,
    uploaded_by,
    file_name: input.file.name,
    file_type: file_type === "pdf" || file_type === "docx" || file_type === "hwp" ? file_type : "pdf",
    file_size_bytes: input.file.size,
    file_storage_key: `mock/contracts/${input.file.name}`,
    page_count: Math.max(3, Math.ceil(input.file.size / 150000)),
    language: "ko",
    industry: input.industry,
    contract_type: input.contract_type,
    party_position: input.party_position,
    status: "parsing",
    overall_risk_score: null,
    risk_level: null,
    template_id: null,
    expires_at: nowIso(90 * 24 * 60),
    deleted_at: null,
    created_at: nowIso(),
  };

  const analysis: Analysis = {
    id: makeId("analysis"),
    contract_id: contract.id,
    status: "parsing",
    progress_pct: STEP_PROGRESS.parsing,
    started_at: nowIso(),
    completed_at: null,
    duration_ms: null,
    model_version: "claude-3-5-sonnet",
    error_message: null,
    focus_areas: input.focus_areas ?? null,
  };

  updateWorkspace((workspace) => ({
    ...workspace,
    contracts: [contract, ...workspace.contracts],
    analyses: [analysis, ...workspace.analyses],
  }));

  return contract;
}

export function advanceMockAnalysis(contractId: string) {
  let nextAnalysis: Analysis | null = null;

  updateWorkspace((workspace) => {
    const contract = workspace.contracts.find((entry) => entry.id === contractId);
    const analysis = workspace.analyses.find((entry) => entry.contract_id === contractId);

    if (!contract || !analysis || analysis.status === "completed" || analysis.status === "failed") {
      nextAnalysis = analysis ?? null;
      return workspace;
    }

    const currentIndex = ANALYSIS_STEPS.indexOf(analysis.status);
    const nextStatus = ANALYSIS_STEPS[Math.min(currentIndex + 1, ANALYSIS_STEPS.length - 1)];

    const updatedAnalysis: Analysis = {
      ...analysis,
      status: nextStatus,
      progress_pct: STEP_PROGRESS[nextStatus],
      completed_at: nextStatus === "completed" ? nowIso() : null,
      duration_ms: nextStatus === "completed" ? 52000 : null,
    };

    let updatedContract = contract;
    const reports = { ...workspace.reports };

    if (nextStatus === "completed") {
      const report = buildReportForContract({ ...contract, status: "completed" });
      updatedContract = report.contract;
      reports[contractId] = {
        ...report,
        contract: updatedContract,
        analysis: updatedAnalysis,
      };
    } else {
      updatedContract = {
        ...contract,
        status: nextStatus === "parsing" ? "parsing" : "analyzing",
      };
    }

    nextAnalysis = updatedAnalysis;

    return {
      ...workspace,
      contracts: workspace.contracts.map((entry) => (entry.id === contractId ? updatedContract : entry)),
      analyses: workspace.analyses.map((entry) =>
        entry.contract_id === contractId ? updatedAnalysis : entry,
      ),
      reports,
    };
  });

  return nextAnalysis;
}
