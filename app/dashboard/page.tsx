"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ContractCard } from "@/components/contract/ContractCard";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useContractStore } from "@/store/useContractStore";

export default function DashboardPage() {
  const contracts = useContractStore((state) => state.contracts);
  const total = useContractStore((state) => state.total);
  const fetchContracts = useContractStore((state) => state.fetch_contracts);

  useEffect(() => {
    void fetchContracts({ page: 1, limit: 6 });
  }, [fetchContracts]);

  const completed = contracts.filter((contract) => contract.status === "completed").length;
  const active = contracts.filter((contract) => contract.status === "parsing" || contract.status === "analyzing").length;
  const averageScore =
    contracts.filter((contract) => contract.overall_risk_score !== null).reduce((acc, contract) => acc + (contract.overall_risk_score ?? 0), 0) /
    Math.max(1, contracts.filter((contract) => contract.overall_risk_score !== null).length);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-xl shadow-slate-200/50">
        <p className="text-sm font-medium text-blue-700">Dashboard</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">ClauseGuard 루트 워크스페이스</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
          donor 프론트 조각을 루트 앱으로 정리한 뒤, 최소 MVP 흐름이 한곳에서 이어지도록 대시보드부터 보관함까지 연결했습니다.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard/upload">
            <Button>새 계약서 업로드</Button>
          </Link>
          <Link href="/dashboard/contracts">
            <Button variant="outline">보관함 열기</Button>
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="보관 중인 계약서" value={`${total}`} description="Mock와 Live 모두 같은 카드 구조를 사용합니다." />
        <MetricCard label="진행 중인 분석" value={`${active}`} description="분석 진행 페이지에서 단계별 상태를 확인할 수 있습니다." tone="warning" />
        <MetricCard label="평균 안정 점수" value={`${Math.round(averageScore || 0)}`} description={`${completed}건의 완료 리포트 기준`} tone="positive" />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">최근 계약서</h2>
            <p className="text-sm text-slate-500">업로드, 분석 진행, 리포트 조회 흐름을 여기서 이어갑니다.</p>
          </div>
        </div>

        {contracts.length ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {contracts.map((contract) => (
              <ContractCard key={contract.id} contract={contract} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="아직 계약서가 없습니다"
            description="업로드 화면에서 첫 계약서를 등록하고 분석 흐름을 시작해 보세요."
            action={
              <Link href="/dashboard/upload">
                <Button>업로드 시작</Button>
              </Link>
            }
          />
        )}
      </section>
    </div>
  );
}
