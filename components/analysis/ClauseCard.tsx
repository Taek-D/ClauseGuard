"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { RiskBadge } from "@/components/analysis/RiskBadge";
import { getSuggestionDecisionLabel } from "@/lib/utils";
import type { ReportRisk } from "@/types";

interface ClauseCardProps {
  risk: ReportRisk;
  index: number;
  reviewEnabled?: boolean;
  isSaving?: boolean;
  onSuggestionDecision?: (suggestionId: string, accepted: boolean | null) => void;
}

function getDecisionClasses(accepted: boolean | null) {
  if (accepted === true) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-500/20";
  }

  if (accepted === false) {
    return "bg-amber-50 text-amber-700 ring-amber-500/20";
  }

  return "bg-slate-100 text-slate-600 ring-slate-300/60";
}

export function ClauseCard({
  risk,
  index,
  reviewEnabled = false,
  isSaving = false,
  onSuggestionDecision,
}: ClauseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const suggestion = risk.suggestions?.[0] ?? null;

  const benchmarkLabel = useMemo(() => {
    if (!risk.industry_benchmark && risk.benchmark_pct === null) return null;
    const parts = [];

    if (risk.industry_benchmark) {
      parts.push(risk.industry_benchmark);
    }

    if (risk.benchmark_pct !== null) {
      parts.push(`${risk.benchmark_pct}% benchmark match`);
    }

    return parts.join(" | ");
  }, [risk.benchmark_pct, risk.industry_benchmark]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        data-testid="risk-card-toggle"
        className="flex w-full items-start justify-between gap-4 p-4 text-left"
        onClick={() => setIsExpanded((current) => !current)}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {index + 1}
          </span>
          <div className="space-y-1">
            <p className="font-medium text-slate-950">{risk.title}</p>
            <p className="text-xs text-slate-500">
              {risk.clauses?.clause_number ?? "Clause number unavailable"} | p.{risk.clauses?.page ?? "-"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <RiskBadge severity={risk.severity} showDot />
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3">
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Original clause</p>
              <blockquote className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                {risk.clauses?.original_text ?? "The original clause text could not be loaded."}
              </blockquote>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Why it matters</p>
              <p className="text-sm leading-6 text-slate-700">{risk.description}</p>
            </div>

            {benchmarkLabel ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Market benchmark</p>
                <p className="mt-1">{benchmarkLabel}</p>
              </div>
            ) : null}

            {suggestion ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested revision</p>
                  <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                    <p className="font-medium">{suggestion.suggested_text}</p>
                    <p className="mt-2 text-blue-800">{suggestion.change_rationale}</p>
                    {suggestion.negotiation_tip ? (
                      <p className="mt-2 text-blue-700">Negotiation tip: {suggestion.negotiation_tip}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review decision</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Use the mock workflow to mark the suggestion as accepted or keep it open for follow-up.
                      </p>
                    </div>
                    <span
                      data-testid="suggestion-decision-badge"
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${getDecisionClasses(
                        suggestion.accepted,
                      )}`}
                    >
                      {getSuggestionDecisionLabel(suggestion.accepted)}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      data-testid="accept-suggestion"
                      size="sm"
                      onClick={() => onSuggestionDecision?.(suggestion.id, true)}
                      disabled={!reviewEnabled || isSaving}
                    >
                      Accept
                    </Button>
                    <Button
                      data-testid="needs-review-suggestion"
                      size="sm"
                      variant="outline"
                      onClick={() => onSuggestionDecision?.(suggestion.id, false)}
                      disabled={!reviewEnabled || isSaving}
                    >
                      Needs review
                    </Button>
                    <Button
                      data-testid="reset-suggestion-decision"
                      size="sm"
                      variant="ghost"
                      onClick={() => onSuggestionDecision?.(suggestion.id, null)}
                      disabled={!reviewEnabled || isSaving}
                    >
                      Reset decision
                    </Button>
                  </div>

                  {!reviewEnabled ? (
                    <p className="text-xs text-slate-500">Suggestion review actions are currently enabled only in mock mode.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
