import type { ReportSummary } from "@/types";

interface RiskSummaryProps {
  summary: ReportSummary;
}

const riskItems = [
  { key: "high_count" as const, label: "High", bg: "bg-rose-50", text: "text-rose-700" },
  { key: "medium_count" as const, label: "Medium", bg: "bg-amber-50", text: "text-amber-700" },
  { key: "low_count" as const, label: "Low", bg: "bg-emerald-50", text: "text-emerald-700" },
];

export function RiskSummary({ summary }: RiskSummaryProps) {
  const total = summary.high_count + summary.medium_count + summary.low_count;
  const tone =
    summary.overall_score === null
      ? "text-slate-700"
      : summary.overall_score >= 80
        ? "text-emerald-700"
        : summary.overall_score >= 60
          ? "text-amber-700"
          : "text-rose-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Overall Risk Score</p>
          <p className={`mt-2 text-4xl font-semibold ${tone}`}>
            {summary.overall_score ?? "N/A"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          총 리스크 항목 {total}건
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {riskItems.map((item) => (
          <div key={item.key} className={`rounded-2xl ${item.bg} px-4 py-4`}>
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <p className={`mt-2 text-3xl font-semibold ${item.text}`}>{summary[item.key]}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
