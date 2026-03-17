"use client";

import { create } from "zustand";

import { analysisApi, contractsApi, reportsApi } from "@/lib/api";
import type {
  Analysis,
  Contract,
  ContractFilters,
  ReportData,
  UploadContractInput,
} from "@/types";

interface ContractState {
  contracts: Contract[];
  selected_contract: Contract | null;
  selected_analysis: Analysis | null;
  selected_report: ReportData | null;
  filters: ContractFilters;
  total: number;
  is_loading: boolean;
  is_uploading: boolean;
  initialized: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  fetch_contracts: (filters?: ContractFilters) => Promise<void>;
  fetch_contract: (contractId: string) => Promise<Contract | null>;
  fetch_analysis: (contractId: string) => Promise<Analysis | null>;
  fetch_report: (contractId: string) => Promise<ReportData | null>;
  upload_contract: (input: UploadContractInput) => Promise<Contract | null>;
  delete_contract: (contractId: string) => Promise<boolean>;
  advance_analysis: (contractId: string) => Promise<Analysis | null>;
  set_filters: (filters: Partial<ContractFilters>) => void;
  clear_selection: () => void;
  clear_error: () => void;
}

const DEFAULT_FILTERS: ContractFilters = {
  page: 1,
  limit: 12,
};

export const useContractStore = create<ContractState>((set, get) => ({
  contracts: [],
  selected_contract: null,
  selected_analysis: null,
  selected_report: null,
  filters: DEFAULT_FILTERS,
  total: 0,
  is_loading: false,
  is_uploading: false,
  initialized: false,
  error: null,

  initialize: async () => {
    if (get().initialized) return;
    await get().fetch_contracts();
    set({ initialized: true });
  },

  fetch_contracts: async (filters) => {
    const nextFilters = { ...get().filters, ...filters };
    set({ is_loading: true, error: null, filters: nextFilters });
    const response = await contractsApi.list(nextFilters);

    if (response.data) {
      const data = response.data;
      set({
        contracts: data.items,
        total: data.total,
        is_loading: false,
      });
      return;
    }

    set({
      is_loading: false,
      error: response.error?.message ?? "계약서 목록을 불러오지 못했습니다.",
    });
  },

  fetch_contract: async (contractId) => {
    set({ is_loading: true, error: null });
    const response = await contractsApi.get(contractId);

    if (response.data) {
      const contract = response.data;
      set({
        selected_contract: contract,
        is_loading: false,
      });
      return contract;
    }

    set({
      selected_contract: null,
      is_loading: false,
      error: response.error?.message ?? "계약서를 불러오지 못했습니다.",
    });
    return null;
  },

  fetch_analysis: async (contractId) => {
    const response = await analysisApi.get(contractId);

    if (response.data) {
      const analysis = response.data;
      set({
        selected_analysis: analysis,
        error: null,
      });
      return analysis;
    }

    set({
      selected_analysis: null,
      error: response.error?.message ?? "분석 상태를 불러오지 못했습니다.",
    });
    return null;
  },

  fetch_report: async (contractId) => {
    const response = await reportsApi.get(contractId);

    if (response.data) {
      const report = response.data;
      set({
        selected_report: report,
        selected_contract: report.contract,
        selected_analysis: report.analysis,
        error: null,
      });
      return report;
    }

    set({
      selected_report: null,
      error: response.error?.message ?? "리포트를 불러오지 못했습니다.",
    });
    return null;
  },

  upload_contract: async (input) => {
    set({ is_uploading: true, error: null });
    const response = await contractsApi.upload(input);

    if (response.data) {
      const contract = response.data;
      set((state) => ({
        contracts: [contract, ...state.contracts],
        total: state.total + 1,
        is_uploading: false,
      }));
      return contract;
    }

    set({
      is_uploading: false,
      error: response.error?.message ?? "계약서 업로드에 실패했습니다.",
    });
    return null;
  },

  delete_contract: async (contractId) => {
    const response = await contractsApi.remove(contractId);
    if (!response.error) {
      set((state) => ({
        contracts: state.contracts.filter((contract) => contract.id !== contractId),
        total: Math.max(0, state.total - 1),
      }));
      return true;
    }

    set({
      error: response.error.message,
    });
    return false;
  },

  advance_analysis: async (contractId) => {
    const response = await analysisApi.advance(contractId);

    if (response.data) {
      const analysis = response.data;
      set({
        selected_analysis: analysis,
        error: null,
      });

      if (analysis.status === "completed") {
        await get().fetch_report(contractId);
        await get().fetch_contracts();
      } else {
        set((state) => ({
          contracts: state.contracts.map((contract) =>
            contract.id === contractId
              ? {
                  ...contract,
                  status: analysis.status === "parsing" ? "parsing" : "analyzing",
                }
              : contract,
          ),
        }));
      }

      return analysis;
    }

    set({
      error: response.error?.message ?? "분석 진행 상태를 갱신하지 못했습니다.",
    });
    return null;
  },

  set_filters: (filters) => {
    set({
      filters: {
        ...get().filters,
        ...filters,
      },
    });
  },

  clear_selection: () =>
    set({
      selected_contract: null,
      selected_analysis: null,
      selected_report: null,
    }),

  clear_error: () => set({ error: null }),
}));
