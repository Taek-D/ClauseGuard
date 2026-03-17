"use client";

import { useEffect, useState } from "react";

import { ContractCard } from "@/components/contract/ContractCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { CONTRACT_STATUS_LABELS } from "@/types";
import { useContractStore } from "@/store/useContractStore";

const STATUS_OPTIONS = Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => ({
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

  useEffect(() => {
    void fetchContracts({ page: 1, limit: 12 });
  }, [fetchContracts]);

  const applyFilters = async () => {
    await fetchContracts({
      page: 1,
      limit: 12,
      search: search || undefined,
      status: status ? (status as keyof typeof CONTRACT_STATUS_LABELS) : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Archive</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">계약서 보관함</h1>
            <p className="mt-2 text-sm text-slate-500">검색과 상태 필터로 현재 저장된 계약서를 빠르게 좁힐 수 있습니다.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_auto]">
            <Input label="검색" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="파일명으로 검색" />
            <Select
              label="상태"
              value={status}
              placeholder="전체"
              options={STATUS_OPTIONS}
              onChange={(event) => setStatus(event.target.value)}
            />
            <Button onClick={() => void applyFilters()}>필터 적용</Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <p className="text-sm text-slate-500">총 {total}건</p>

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
          <EmptyState title="조건에 맞는 계약서가 없습니다" description="검색어나 상태 필터를 바꾸고 다시 시도해 보세요." />
        )}
      </section>
    </div>
  );
}
