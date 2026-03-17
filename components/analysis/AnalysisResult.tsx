"use client";

import { useMemo, useState } from "react";

import { ClauseCard } from "@/components/analysis/ClauseCard";
import { RiskSummary } from "@/components/analysis/RiskSummary";
import { getSuggestionDecisionLabel } from "@/lib/utils";
import type { ReportData, Severity } from "@/types";

interface AnalysisResultProps {
  report: ReportData;
  reviewEnabled?: boolean;
  isReviewSaving?: boolean;
  onSuggestionDecision?: (suggestionId: string, accepted: boolean | null) => void;
}

const FILTER_OPTIONS: Array<{ value: Severity | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function AnalysisResult({
  report,
  reviewEnabled = false,
  isReviewSaving = false,
  onSuggestionDecision,
}: AnalysisResultProps) {
  const [filter, setFilter] = useState<Severity | "all">("all");

  const filteredRisks = useMemo(
    () => (filter === "all" ? report.risks : report.risks.filter((risk) => risk.severity === filter)),
    [filter, report.risks],
  );

  const reviewStats = useMemo(() => {
    const decisions = report.risks.flatMap((risk) => risk.suggestions ?? []).map((suggestion) => suggestion.accepted);
    return {
      accepted: decisions.filter((decision) => decision === true).length,
      needs_review: decisions.filter((decision) => decision === false).length,
      pending: decisions.filter((decision) => decision === null).length,
      total: decisions.length,
    };
  }, [report.risks]);

  const headline = useMemo(() => {
    if (report.summary.high_count > 0) {
      return "At least one clause needs immediate negotiation or legal review.";
    }
    if (report.summary.medium_count > 0) {
      return "A few terms should be tightened before the contract is approved.";
    }
    return "No critical risks were found, but a final clause-by-clause review is still recommended.";
  }, [report.summary.high_count, report.summary.medium_count]);

  return (
    <div className="space-y-6">
      <RiskSummary summary={report.summary} />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Key takeaway</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{headline}</p>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
            {report.risks.slice(0, 3).map((risk) => (
              <li key={risk.id} className="flex gap-2">
                <span className="text-blue-600">•</span>
                <span>{risk.title}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Review progress</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {reviewStats.total - reviewStats.pending}/{reviewStats.total}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {reviewEnabled ? "Mock review mode" : "Read only"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Accepted</p>
              <p className="mt-2 text-xl font-semibold text-emerald-900">{reviewStats.accepted}</p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Needs review</p>
              <p className="mt-2 text-xl font-semibold text-amber-900">{reviewStats.needs_review}</p>
            </div>
            <div className="rounded-2xl bg-slate-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Pending</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{reviewStats.pending}</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Current default state:{" "}
            <span className="font-medium text-slate-700">{getSuggestionDecisionLabel(null)}</span>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Clause-level risk review</h2>
            <p className="text-sm text-slate-500">
              Filter the list by severity, then mark each suggestion as accepted or keep it open for follow-up.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === option.value
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50"
                }`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRisks.length ? (
          <div className="space-y-3">
            {filteredRisks.map((risk, index) => (
              <ClauseCard
                key={risk.id}
                risk={risk}
                index={index}
                reviewEnabled={reviewEnabled}
                isSaving={isReviewSaving}
                onSuggestionDecision={onSuggestionDecision}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-700">No clauses match the current severity filter.</p>
            <p className="mt-2 text-sm text-slate-500">Switch the filter to review the rest of the mock report.</p>
          </div>
        )}
      </div>
    </div>
  );
}
