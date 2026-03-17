"use client";

import { functionsBaseUrl, isSupabaseConfigured, runtimeMode } from "@/lib/env";
import {
  advanceMockAnalysis,
  clearMockWorkspaceUser,
  deleteMockContract,
  enterMockWorkspace,
  ensureMockWorkspace,
  getMockAnalysis,
  getMockContract,
  getMockReport,
  getMockUser,
  listMockContracts,
  setMockUser,
  uploadMockContract,
} from "@/lib/mock-data";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type {
  Analysis,
  ApiError,
  ApiResult,
  AppUser,
  Contract,
  ContractFilters,
  ContractListResponse,
  ReportData,
  RuntimeMode,
  UploadContractInput,
  UserProfile,
} from "@/types";

interface SuccessEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

function toApiError(error: unknown, fallbackMessage: string): ApiError {
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return {
      code: "UNEXPECTED_ERROR",
      message: error.message,
    };
  }

  return {
    code: "UNEXPECTED_ERROR",
    message: fallbackMessage,
  };
}

async function getAccessToken() {
  const client = getSupabaseBrowserClient();
  if (!client) return null;

  const {
    data: { session },
  } = await client.auth.getSession();

  return session?.access_token ?? null;
}

async function requestFunction<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<SuccessEnvelope<T>>> {
  try {
    const token = await getAccessToken();
    const headers = new Headers(init.headers);

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${functionsBaseUrl}${path}`, {
      ...init,
      headers,
    });

    if (response.status === 204) {
      return {
        data: {
          data: null as T,
        },
      };
    }

    const payload = (await response.json().catch(() => null)) as
      | SuccessEnvelope<T>
      | { error?: ApiError }
      | null;

    if (!response.ok) {
      return {
        error:
          payload && "error" in payload && payload.error
            ? payload.error
            : {
                code: String(response.status),
                message: response.statusText || "요청에 실패했습니다.",
              },
      };
    }

    return {
      data: payload as SuccessEnvelope<T>,
    };
  } catch (error) {
    return {
      error: toApiError(error, "네트워크 요청에 실패했습니다."),
    };
  }
}

function mapUserProfileToAppUser(profile: UserProfile, emailOverride?: string): AppUser {
  return {
    id: profile.id,
    email: emailOverride ?? profile.email,
    name: profile.name,
    auth_provider: profile.auth_provider,
    role_preference: profile.role_preference,
    language: profile.language,
    plan: "free",
    role: "owner",
    organization_name: "ClauseGuard Workspace",
  };
}

export function getRuntimeMode(): RuntimeMode {
  return runtimeMode as RuntimeMode;
}

export const authApi = {
  async getCurrentUser(): Promise<ApiResult<AppUser | null>> {
    if (!isSupabaseConfigured) {
      ensureMockWorkspace();
      return { data: getMockUser() };
    }

    try {
      const client = getSupabaseBrowserClient();
      if (!client) {
        return { data: null };
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!session?.user) {
        return { data: null };
      }

      const profileResponse = await requestFunction<UserProfile>("/users/me");
      if (profileResponse.data?.data) {
        return {
          data: mapUserProfileToAppUser(profileResponse.data.data, session.user.email ?? undefined),
        };
      }

      return {
        data: {
          id: session.user.id,
          email: session.user.email ?? "",
          name:
            session.user.user_metadata?.full_name ??
            session.user.user_metadata?.name ??
            session.user.email?.split("@")[0] ??
            "ClauseGuard User",
          auth_provider: session.user.app_metadata?.provider === "google" ? "google" : "email",
          role_preference: null,
          language: "ko",
          plan: "free",
          role: "owner",
          organization_name: "ClauseGuard Workspace",
        },
      };
    } catch (error) {
      return {
        error: toApiError(error, "현재 세션을 확인하지 못했습니다."),
      };
    }
  },

  async signIn(email: string, password: string): Promise<ApiResult<AppUser>> {
    if (!isSupabaseConfigured) {
      return {
        data: enterMockWorkspace(email),
      };
    }

    try {
      const client = getSupabaseBrowserClient();
      if (!client) {
        return {
          error: {
            code: "SUPABASE_NOT_READY",
            message: "Supabase 클라이언트를 초기화하지 못했습니다.",
          },
        };
      }

      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        return {
          error: {
            code: error.code ?? "AUTH_ERROR",
            message: error.message,
          },
        };
      }

      const currentUser = await authApi.getCurrentUser();
      if (currentUser.data) {
        return { data: currentUser.data };
      }

      return {
        error: currentUser.error ?? {
          code: "AUTH_STATE_ERROR",
          message: "Signed in, but the user profile could not be loaded.",
        },
      };
    } catch (error) {
      return {
        error: toApiError(error, "로그인에 실패했습니다."),
      };
    }
  },

  async signInWithGoogle(): Promise<ApiResult<AppUser | null>> {
    if (!isSupabaseConfigured) {
      return { data: null };
    }

    try {
      const client = getSupabaseBrowserClient();
      if (!client) {
        return {
          error: {
            code: "SUPABASE_NOT_READY",
            message: "Supabase 클라이언트를 초기화하지 못했습니다.",
          },
        };
      }

      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        return {
          error: {
            code: error.code ?? "OAUTH_ERROR",
            message: error.message,
          },
        };
      }

      return {
        data: enterMockWorkspace("founder@gmail.com"),
      };
    } catch (error) {
      return {
        error: toApiError(error, "Google 로그인에 실패했습니다."),
      };
    }
  },

  async enterDemo(): Promise<ApiResult<AppUser>> {
    return { data: enterMockWorkspace() };
  },

  async signOut(): Promise<ApiResult<null>> {
    if (!isSupabaseConfigured) {
      clearMockWorkspaceUser();
      return { data: null };
    }

    try {
      const client = getSupabaseBrowserClient();
      if (client) {
        await client.auth.signOut();
      }

      setMockUser(null);

      return { data: null };
    } catch (error) {
      return {
        error: toApiError(error, "로그아웃에 실패했습니다."),
      };
    }
  },
};

export const contractsApi = {
  async list(filters: ContractFilters = {}): Promise<ApiResult<ContractListResponse>> {
    if (!isSupabaseConfigured) {
      ensureMockWorkspace();
      return { data: listMockContracts(filters) };
    }

    const params = new URLSearchParams();
    if (filters.page) params.set("page", String(filters.page));
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.search) params.set("search", filters.search);
    if (filters.industry) params.set("industry", filters.industry);
    if (filters.contract_type) params.set("contract_type", filters.contract_type);
    if (filters.status) params.set("status", filters.status);
    if (filters.risk_level) params.set("risk_level", filters.risk_level);

    const response = await requestFunction<Contract[]>(`/contracts?${params.toString()}`);
    if (!response.data) {
      return { error: response.error };
    }

    return {
      data: {
        items: response.data.data,
        total: Number(response.data.meta?.total ?? response.data.data.length),
        page: Number(response.data.meta?.page ?? filters.page ?? 1),
        limit: Number(response.data.meta?.limit ?? filters.limit ?? 12),
      },
    };
  },

  async get(contractId: string): Promise<ApiResult<Contract>> {
    if (!isSupabaseConfigured) {
      ensureMockWorkspace();
      const contract = getMockContract(contractId);
      return contract
        ? { data: contract }
        : {
            error: {
              code: "NOT_FOUND",
              message: "계약서를 찾을 수 없습니다.",
            },
          };
    }

    const response = await requestFunction<Contract>(`/contracts/${contractId}`);
    return response.data ? { data: response.data.data } : { error: response.error };
  },

  async upload(input: UploadContractInput): Promise<ApiResult<Contract>> {
    if (!isSupabaseConfigured) {
      ensureMockWorkspace();
      return { data: uploadMockContract(input) };
    }

    const body = new FormData();
    body.append("file", input.file);
    body.append("industry", input.industry);
    body.append("contract_type", input.contract_type);
    body.append("party_position", input.party_position);

    if (input.focus_areas?.length) {
      body.append("focus_areas", JSON.stringify(input.focus_areas));
    }

    const response = await requestFunction<Contract>("/contracts", {
      method: "POST",
      body,
    });

    return response.data ? { data: response.data.data } : { error: response.error };
  },

  async remove(contractId: string): Promise<ApiResult<null>> {
    if (!isSupabaseConfigured) {
      deleteMockContract(contractId);
      return { data: null };
    }

    const response = await requestFunction<null>(`/contracts/${contractId}`, {
      method: "DELETE",
    });

    return response.error ? { error: response.error } : { data: null };
  },
};

export const analysisApi = {
  async get(contractId: string): Promise<ApiResult<Analysis>> {
    if (!isSupabaseConfigured) {
      const analysis = getMockAnalysis(contractId);
      return analysis
        ? { data: analysis }
        : {
            error: {
              code: "NOT_FOUND",
              message: "분석 상태를 찾을 수 없습니다.",
            },
          };
    }

    const response = await requestFunction<Analysis>(`/analysis/${contractId}`);
    return response.data ? { data: response.data.data } : { error: response.error };
  },

  async advance(contractId: string): Promise<ApiResult<Analysis>> {
    if (!isSupabaseConfigured) {
      const analysis = advanceMockAnalysis(contractId);
      return analysis
        ? { data: analysis }
        : {
            error: {
              code: "NOT_FOUND",
              message: "진행 중인 분석을 찾을 수 없습니다.",
            },
          };
    }

    return analysisApi.get(contractId);
  },
};

export const reportsApi = {
  async get(contractId: string): Promise<ApiResult<ReportData>> {
    if (!isSupabaseConfigured) {
      const report = getMockReport(contractId);
      return report
        ? { data: report }
        : {
            error: {
              code: "NOT_FOUND",
              message: "리포트를 찾을 수 없습니다.",
            },
          };
    }

    const response = await requestFunction<ReportData>(`/reports/${contractId}`);
    return response.data ? { data: response.data.data } : { error: response.error };
  },
};
