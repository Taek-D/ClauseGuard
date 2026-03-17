"use client";

import { useMemo, useState } from "react";

import { ClauseCard } from "@/components/analysis/ClauseCard";
import { RiskSummary } from "@/components/analysis/RiskSummary";
import type { ReportData, Severity } from "@/types";

interface AnalysisResultProps {
  report: ReportData;
}

const FILTER_OPTIONS: Array<{ value: Severity | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function AnalysisResult({ report }: AnalysisResultProps) {
  const [filter, setFilter] = useState<Severity | "all">("all");

  const filteredRisks = useMemo(
    () => (filter === "all" ? report.risks : report.risks.filter((risk) => risk.severity === filter)),
    [filter, report.risks],
  );

  const headline = useMemo(() => {
    if (report.summary.high_count > 0) {
      return "즉시 협상 또는 법무 검토가 필요한 조항이 포함되어 있습니다.";
    }
    if (report.summary.medium_count > 0) {
      return "수정 제안을 반영하면 리스크를 상당 부분 줄일 수 있습니다.";
    }
    return "치명적인 리스크는 없지만 세부 조건을 한 번 더 확인하는 것이 좋습니다.";
  }, [report.summary.high_count, report.summary.medium_count]);

  return (
    <div className="space-y-6">
      <RiskSummary summary={report.summary} />

      <div className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">핵심 해석</p>
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

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">조항별 리스크</h2>
            <p className="text-sm text-slate-500">필터를 바꿔 중요도별 조항만 빠르게 볼 수 있습니다.</p>
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

        <div className="space-y-3">
          {filteredRisks.map((risk, index) => (
            <ClauseCard key={risk.id} risk={risk} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
