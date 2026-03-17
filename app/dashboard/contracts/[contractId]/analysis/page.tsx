"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ANALYSIS_STATUS_LABELS, ANALYSIS_PIPELINE } from "@/types";
import { formatRelativeDate, getContractTitle } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useContractStore } from "@/store/useContractStore";

export default function ContractAnalysisPage() {
  const params = useParams<{ contractId: string }>();
  const contractId = params.contractId;
  const runtimeMode = useAuthStore((state) => state.runtime_mode);
  const contract = useContractStore((state) => state.selected_contract);
  const analysis = useContractStore((state) => state.selected_analysis);
  const fetchContract = useContractStore((state) => state.fetch_contract);
  const fetchAnalysis = useContractStore((state) => state.fetch_analysis);
  const advanceAnalysis = useContractStore((state) => state.advance_analysis);

  useEffect(() => {
    if (!contractId) return;
    void fetchContract(contractId);
    void fetchAnalysis(contractId);
  }, [contractId, fetchAnalysis, fetchContract]);

  useEffect(() => {
    if (!contractId || !analysis || analysis.status === "completed" || analysis.status === "failed") {
      return;
    }

    const handle = window.setInterval(() => {
      if (runtimeMode === "mock") {
        void advanceAnalysis(contractId);
      } else {
        void fetchAnalysis(contractId);
      }
    }, runtimeMode === "mock" ? 1400 : 2500);

    return () => window.clearInterval(handle);
  }, [advanceAnalysis, analysis, contractId, fetchAnalysis, runtimeMode]);

  if (!contract || !analysis) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" label="분석 상태를 불러오는 중입니다..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-sm">
        <p className="text-sm font-medium text-slate-500">Analysis Progress</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">{getContractTitle(contract)}</h1>
        <p className="mt-2 text-sm text-slate-500">
          분석 시작 {formatRelativeDate(analysis.started_at)} · 현재 단계 {ANALYSIS_STATUS_LABELS[analysis.status]}
        </p>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
            <span>진행률</span>
            <span>{analysis.progress_pct}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${analysis.progress_pct}%` }} />
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-6 shadow-sm">
        <div className="space-y-3">
          {ANALYSIS_PIPELINE.map((step, index) => {
            const activeIndex = ANALYSIS_PIPELINE.indexOf(analysis.status);
            const isDone = activeIndex > index || analysis.status === "completed";
            const isActive = analysis.status === step;

            return (
              <div key={step} className="flex items-start gap-4 rounded-2xl border border-slate-100 px-4 py-4">
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    isDone
                      ? "bg-emerald-100 text-emerald-700"
                      : isActive
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {isDone ? "✓" : index + 1}
                </div>
                <div>
                  <p className="font-medium text-slate-950">{ANALYSIS_STATUS_LABELS[step]}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {isDone ? "완료됨" : isActive ? "현재 실행 중" : "대기 중"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {analysis.status === "completed" ? (
          <div className="mt-6 flex justify-end">
            <Link href={`/dashboard/contracts/${contract.id}`}>
              <Button size="lg">리스크 리포트 보기</Button>
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
