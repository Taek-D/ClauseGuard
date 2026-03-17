"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AnalysisResult } from "@/components/analysis/AnalysisResult";
import { RiskBadge } from "@/components/analysis/RiskBadge";
import { ContractStatusBadge } from "@/components/contract/ContractStatusBadge";
import { Button } from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { buildReportClipboardText, formatDate, getContractTitle } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { useContractStore } from "@/store/useContractStore";

export default function ContractReportPage() {
  const params = useParams<{ contractId: string }>();
  const contractId = params.contractId;
  const runtimeMode = useAuthStore((state) => state.runtime_mode);
  const report = useContractStore((state) => state.selected_report);
  const contract = useContractStore((state) => state.selected_contract);
  const isReviewSaving = useContractStore((state) => state.is_review_saving);
  const fetchContract = useContractStore((state) => state.fetch_contract);
  const fetchReport = useContractStore((state) => state.fetch_report);
  const updateSuggestionDecision = useContractStore((state) => state.update_suggestion_decision);

  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (!contractId) return;
    void fetchContract(contractId);
    void fetchReport(contractId);
  }, [contractId, fetchContract, fetchReport]);

  useEffect(() => {
    if (copyState === "idle") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  if (!contract && !report) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" label="Preparing the report..." />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white/95 p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">The report is not ready yet</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            This contract is still in progress or no completed report is available yet. Open the analysis timeline to
            continue the mock review flow.
          </p>
          {contract ? (
            <div className="mt-6">
              <ContractStatusBadge status={contract.status} />
            </div>
          ) : null}
          <div className="mt-8">
            <Link href={`/dashboard/contracts/${contractId}/analysis`}>
              <Button>Open analysis timeline</Button>
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (!copied) {
      throw new Error("Copy command failed.");
    }
  };

  const handleCopySummary = async () => {
    try {
      await copyText(buildReportClipboardText(report));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Risk Report</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">{getContractTitle(report.contract)}</h1>
            <p className="mt-2 text-sm text-slate-500">
              Uploaded on {formatDate(report.contract.created_at)} | File {report.contract.file_name}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <ContractStatusBadge status={report.contract.status} />
            {report.contract.risk_level ? <RiskBadge severity={report.contract.risk_level} showDot /> : null}
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {runtimeMode === "mock"
            ? "Mock mode is active. Suggestion decisions are saved locally so you can simulate a real review pass."
            : "Live mode is active. Summary copy is available, and suggestion review actions will be wired next."}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={`/dashboard/contracts/${report.contract.id}/analysis`}>
            <Button variant="outline">Analysis timeline</Button>
          </Link>
          <Button data-testid="copy-summary" variant="secondary" onClick={() => void handleCopySummary()}>
            {copyState === "copied"
              ? "Summary copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy summary"}
          </Button>
          <Link href="/dashboard/contracts">
            <Button variant="ghost">Back to archive</Button>
          </Link>
        </div>
      </section>

      <AnalysisResult
        report={report}
        reviewEnabled={runtimeMode === "mock"}
        isReviewSaving={isReviewSaving}
        onSuggestionDecision={(suggestionId, accepted) =>
          void updateSuggestionDecision(report.contract.id, suggestionId, accepted)
        }
      />
    </div>
  );
}
