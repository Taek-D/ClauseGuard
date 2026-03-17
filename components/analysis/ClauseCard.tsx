"use client";

import { useState } from "react";

import { RiskBadge } from "@/components/analysis/RiskBadge";
import type { ReportRisk } from "@/types";

interface ClauseCardProps {
  risk: ReportRisk;
  index: number;
}

export function ClauseCard({ risk, index }: ClauseCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
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
              {risk.clauses?.clause_number ?? "조항 번호 없음"} · p.{risk.clauses?.page ?? "-"}
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
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">원문</p>
              <blockquote className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                {risk.clauses?.original_text ?? "원문을 불러오지 못했습니다."}
              </blockquote>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">왜 중요하나</p>
              <p className="text-sm leading-6 text-slate-700">{risk.description}</p>
            </div>

            {risk.suggestions?.[0] ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">수정 제안</p>
                <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
                  <p className="font-medium">{risk.suggestions[0].suggested_text}</p>
                  <p className="mt-2 text-blue-800">{risk.suggestions[0].change_rationale}</p>
                  {risk.suggestions[0].negotiation_tip ? (
                    <p className="mt-2 text-blue-700">협상 팁: {risk.suggestions[0].negotiation_tip}</p>
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
