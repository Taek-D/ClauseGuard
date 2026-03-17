import { forwardRef } from "react";

import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
            "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
            error && "border-rose-400 focus:border-rose-400 focus:ring-rose-500/20",
            className,
          )}
          {...props}
        />
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {!error && hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
    );
  },
);

Input.displayName = "Input";
