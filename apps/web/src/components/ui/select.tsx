import { forwardRef, type SelectHTMLAttributes } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid = false, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={[
        "block min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
        invalid
          ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/30"
          : "border-slate-300 focus-visible:border-brand-500",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
