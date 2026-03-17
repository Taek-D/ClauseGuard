"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AnalysisResult } from "@/components/analysis/AnalysisResult";
import { RiskBadge } from "@/components/analysis/RiskBadge";
import { ContractStatusBadge } from "@/components/contract/ContractStatusBadge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { formatDate, getContractTitle } from "@/lib/utils";
import { useContractStore } from "@/store/useContractStore";

export default function ContractReportPage() {
  const params = useParams<{ contractId: string }>();
  const contractId = params.contractId;
  const report = useContractStore((state) => state.selected_report);
  const contract = useContractStore((state) => state.selected_contract);
  const fetchContract = useContractStore((state) => state.fetch_contract);
  const fetchReport = useContractStore((state) => state.fetch_report);

  useEffect(() => {
    if (!contractId) return;
    void fetchContract(contractId);
    void fetchReport(contractId);
  }, [contractId, fetchContract, fetchReport]);

  if (!contract && !report) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" label="리포트를 준비하는 중입니다..." />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">리포트가 아직 준비되지 않았습니다</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            현재 계약서는 아직 분석 중이거나 완료 데이터가 없습니다. 분석 진행 화면에서 상태를 먼저 확인해 주세요.
          </p>
          {contract ? (
            <div className="mt-6">
              <ContractStatusBadge status={contract.status} />
            </div>
          ) : null}
          <div className="mt-8">
            <Link href={`/dashboard/contracts/${contractId}/analysis`}>
              <Button>분석 진행 화면으로 이동</Button>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Risk Report</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">{getContractTitle(report.contract)}</h1>
            <p className="mt-2 text-sm text-slate-500">
              업로드일 {formatDate(report.contract.created_at)} · 파일 {report.contract.file_name}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ContractStatusBadge status={report.contract.status} />
            {report.contract.risk_level ? <RiskBadge severity={report.contract.risk_level} showDot /> : null}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={`/dashboard/contracts/${report.contract.id}/analysis`}>
            <Button variant="outline">분석 진행 이력</Button>
          </Link>
          <Link href="/dashboard/contracts">
            <Button variant="ghost">보관함으로 돌아가기</Button>
          </Link>
        </div>
      </section>

      <AnalysisResult report={report} />
    </div>
  );
}
