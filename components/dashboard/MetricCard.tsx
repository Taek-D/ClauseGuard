import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  description: string;
  tone?: "neutral" | "positive" | "warning";
}

const toneClasses: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "from-white to-slate-50",
  positive: "from-emerald-50 to-white",
  warning: "from-amber-50 to-white",
};

export function MetricCard({
  label,
  value,
  description,
  tone = "neutral",
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-gradient-to-br p-5 shadow-sm",
        toneClasses[tone],
      )}
    >
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}
