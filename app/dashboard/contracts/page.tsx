"use client";

import { useEffect, useMemo, useState } from "react";

import { ContractCard } from "@/components/contract/ContractCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  INDUSTRY_LABELS,
  SEVERITY_LABELS,
  type ContractFilters,
  type ContractStatus,
  type ContractType,
  type IndustryType,
  type Severity,
} from "@/types";
import { useContractStore } from "@/store/useContractStore";

const STATUS_OPTIONS = Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const INDUSTRY_OPTIONS = Object.entries(INDUSTRY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const CONTRACT_TYPE_OPTIONS = Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const RISK_OPTIONS = Object.entries(SEVERITY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function ContractsPage() {
  const contracts = useContractStore((state) => state.contracts);
  const total = useContractStore((state) => state.total);
  const fetchContracts = useContractStore((state) => state.fetch_contracts);
  const deleteContract = useContractStore((state) => state.delete_contract);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [industry, setIndustry] = useState("");
  const [contractType, setContractType] = useState("");
  const [riskLevel, setRiskLevel] = useState("");

  useEffect(() => {
    void fetchContracts({ page: 1, limit: 12 });
  }, [fetchContracts]);

  const activeFilters = useMemo(
    () =>
      [
        search ? `Search: ${search}` : null,
        status ? `Status: ${CONTRACT_STATUS_LABELS[status as ContractStatus]}` : null,
        industry ? `Industry: ${INDUSTRY_LABELS[industry as IndustryType]}` : null,
        contractType ? `Type: ${CONTRACT_TYPE_LABELS[contractType as ContractType]}` : null,
        riskLevel ? `Risk: ${SEVERITY_LABELS[riskLevel as Severity]}` : null,
      ].filter(Boolean) as string[],
    [contractType, industry, riskLevel, search, status],
  );

  const applyFilters = async () => {
    const filters: ContractFilters = {
      page: 1,
      limit: 12,
      search: search || undefined,
      status: status ? (status as ContractStatus) : undefined,
      industry: industry ? (industry as IndustryType) : undefined,
      contract_type: contractType ? (contractType as ContractType) : undefined,
      risk_level: riskLevel ? (riskLevel as Severity) : undefined,
    };

    await fetchContracts(filters);
  };

  const resetFilters = async () => {
    setSearch("");
    setStatus("");
    setIndustry("");
    setContractType("");
    setRiskLevel("");
    await fetchContracts({
      page: 1,
      limit: 12,
      search: undefined,
      status: undefined,
      industry: undefined,
      contract_type: undefined,
      risk_level: undefined,
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Archive</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">Find the right contract faster</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
                Filter by document status, business context, and risk level so the mock workspace behaves more like a
                real review queue.
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span>{total} contracts</span>
              {activeFilters.length ? <span>{activeFilters.length} active filters</span> : <span>Newest first</span>}
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(220px,1.5fr)_180px_180px_180px_180px]">
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by file name"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void applyFilters();
                }
              }}
            />
            <Select
              label="Status"
              value={status}
              placeholder="All statuses"
              options={STATUS_OPTIONS}
              onChange={(event) => setStatus(event.target.value)}
            />
            <Select
              label="Industry"
              value={industry}
              placeholder="All industries"
              options={INDUSTRY_OPTIONS}
              onChange={(event) => setIndustry(event.target.value)}
            />
            <Select
              label="Contract type"
              value={contractType}
              placeholder="All contract types"
              options={CONTRACT_TYPE_OPTIONS}
              onChange={(event) => setContractType(event.target.value)}
            />
            <Select
              label="Risk level"
              value={riskLevel}
              placeholder="All risks"
              options={RISK_OPTIONS}
              onChange={(event) => setRiskLevel(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {activeFilters.length ? (
                activeFilters.map((filter) => (
                  <span
                    key={filter}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {filter}
                  </span>
                ))
              ) : (
                <span className="text-sm text-slate-500">No filters applied. Showing the full mock archive.</span>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void applyFilters()}>
                Apply filters
              </Button>
              <Button variant="ghost" onClick={() => void resetFilters()}>
                Reset filters
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {contracts.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {contracts.map((contract) => (
              <ContractCard
                key={contract.id}
                contract={contract}
                onDelete={(contractId) => void deleteContract(contractId)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No contracts match the current filters"
            description="Try widening the search or resetting the archive filters."
            action={
              <Button variant="outline" onClick={() => void resetFilters()}>
                Reset filters
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
