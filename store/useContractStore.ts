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
  is_review_saving: boolean;
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
  update_suggestion_decision: (
    contractId: string,
    suggestionId: string,
    accepted: boolean | null,
  ) => Promise<boolean>;
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
  is_review_saving: false,
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
      error: response.error?.message ?? "The contract list could not be loaded.",
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
      error: response.error?.message ?? "The contract could not be loaded.",
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
      error: response.error?.message ?? "The analysis status could not be loaded.",
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
      error: response.error?.message ?? "The report could not be loaded.",
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
      error: response.error?.message ?? "The contract upload failed.",
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
              : contract
          ),
        }));
      }

      return analysis;
    }

    set({
      error: response.error?.message ?? "The analysis status could not be refreshed.",
    });
    return null;
  },

  update_suggestion_decision: async (contractId, suggestionId, accepted) => {
    set({ is_review_saving: true, error: null });
    const response = await reportsApi.updateSuggestionDecision(contractId, suggestionId, accepted);

    if (response.data) {
      const report = response.data;
      set((state) => ({
        selected_report: report,
        selected_contract:
          state.selected_contract?.id === contractId ? report.contract : state.selected_contract,
        is_review_saving: false,
      }));
      return true;
    }

    set({
      is_review_saving: false,
      error: response.error?.message ?? "The suggestion decision could not be saved.",
    });
    return false;
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
