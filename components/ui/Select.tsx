import { forwardRef } from "react";

import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, options, placeholder, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900",
            "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20",
            error && "border-rose-400 focus:border-rose-400 focus:ring-rose-500/20",
            className,
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        {!error && hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
    );
  },
);

Select.displayName = "Select";
