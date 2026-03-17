import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        high: "bg-red-50 text-red-700 ring-red-600/20",
        medium: "bg-amber-50 text-amber-700 ring-amber-500/20",
        low: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
        uploaded: "bg-slate-100 text-slate-700 ring-slate-400/20",
        parsing: "bg-sky-50 text-sky-700 ring-sky-500/20",
        analyzing: "bg-blue-50 text-blue-700 ring-blue-500/20",
        completed: "bg-emerald-50 text-emerald-700 ring-emerald-500/20",
        failed: "bg-rose-50 text-rose-700 ring-rose-500/20",
        info: "bg-indigo-50 text-indigo-700 ring-indigo-500/20",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
