import type { SVGProps } from "react";

type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  label?: string;
  size?: SpinnerSize;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "size-4",
  md: "size-5",
  lg: "size-8",
};

export function Spinner({
  className,
  label = "Loading",
  size = "md",
  ...props
}: SpinnerProps) {
  return (
    <span
      className="inline-flex items-center justify-center"
      role={label ? "status" : undefined}
    >
      <svg
        aria-hidden="true"
        className={[
          "animate-spin motion-reduce:animate-none",
          sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        fill="none"
        viewBox="0 0 24 24"
        {...props}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-90"
          d="M4 12a8 8 0 0 1 8-8"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
